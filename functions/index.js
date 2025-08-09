const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Cloud Function that triggers when a new delivery document is created
// This function is create-only and idempotent (won't send duplicate webhooks)
exports.onDeliveryCreated_sendWebhook = functions.firestore
  .document('deliveries/{id}')
  .onCreate(async (snap, context) => {
    const deliveryId = context.params.id;
    const deliveryData = snap.data();
    
    // Generate unique execution ID for this function run
    const executionId = `${deliveryId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    functions.logger.info(`🚀 Function started - Execution ID: ${executionId}, Delivery: ${deliveryId}`);
    functions.logger.info(`📋 Delivery data received:`, JSON.stringify(deliveryData, null, 2));
    
    // CRITICAL: Early check - If webhook already sent, skip immediately
    if (deliveryData.scheduledWebhookSent === true) {
      functions.logger.info(`❌ Webhook already sent for delivery ${deliveryId}, skipping - Execution: ${executionId}`);
      return null;
    }
    
    try {
      // Pre-check: Only process PENDING deliveries
      if (deliveryData.status && deliveryData.status !== 'PENDING') {
        functions.logger.info(`❌ Delivery ${deliveryId} status is not PENDING (${deliveryData.status}), skipping webhook - Execution: ${executionId}`);
        return null;
      }
      
      // Skip internal events and equipment maintenance
      if (deliveryData.entryType === 'internal' || deliveryData.entryType === 'equipmentMaintenance') {
        functions.logger.info(`❌ Delivery ${deliveryId} is internal/maintenance (${deliveryData.entryType}), skipping webhook - Execution: ${executionId}`);
        return null;
      }
      
      // CRITICAL: Use transaction with unique execution tracking
      let webhookShouldBeSent = false;
      let transactionSuccess = false;
      
      await db.runTransaction(async (transaction) => {
        // Re-read the document within the transaction to get latest state
        const docRef = snap.ref;
        const freshDoc = await transaction.get(docRef);
        
        if (!freshDoc.exists) {
          functions.logger.warn(`❌ Document ${deliveryId} no longer exists, skipping webhook - Execution: ${executionId}`);
          return;
        }
        
        const freshData = freshDoc.data();
        
        // CRITICAL: Double-check if webhook was already sent (race condition protection)
        if (freshData.scheduledWebhookSent === true) {
          functions.logger.info(`❌ Webhook already sent for delivery ${deliveryId} (detected in transaction), skipping - Execution: ${executionId}`);
          return;
        }
        
        // ATOMIC: Set multiple flags to prevent any possibility of duplication
        transaction.update(docRef, {
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp(),
          webhookExecutionId: executionId,
          webhookProcessedBy: 'onDeliveryCreated_sendWebhook'
        });
        
        webhookShouldBeSent = true;
        transactionSuccess = true;
        functions.logger.info(`✅ Transaction completed: marked webhook as sent for delivery ${deliveryId} - Execution: ${executionId}`);
      });
      
      // Triple verification before sending webhook
      if (!webhookShouldBeSent || !transactionSuccess) {
        functions.logger.info(`❌ Webhook flag was not set for delivery ${deliveryId}, skipping webhook send - Execution: ${executionId}`);
        return null;
      }
      
      // FINAL VERIFICATION: Re-read document to ensure flag is set
      const verifyDoc = await snap.ref.get();
      const verifyData = verifyDoc.exists() ? verifyDoc.data() : {};
      
      if (!verifyDoc.exists || 
          verifyData.scheduledWebhookSent !== true || 
          verifyData.webhookExecutionId !== executionId) {
        functions.logger.warn(`❌ Webhook flag verification failed for delivery ${deliveryId}, skipping webhook send - Execution: ${executionId}`);
        functions.logger.warn(`Verification details:`, {
          docExists: verifyDoc.exists(),
          webhookSent: verifyData.scheduledWebhookSent,
          executionId: executionId,
          storedExecutionId: verifyData.webhookExecutionId
        });
        return null;
      }
      
      functions.logger.info(`🎯 All verifications passed, proceeding with webhook send - Execution: ${executionId}`);
      
      // Extract fields with comprehensive fallbacks and validation
      const customerName = deliveryData.customerName || deliveryData.clientName || 'Unknown Customer';
      const customerPhone = deliveryData.customerPhone || deliveryData.clientPhone || deliveryData.phone || deliveryData.destinationPhone || '';
      const address = deliveryData.address || deliveryData.deliveryAddress || '';
      const scheduledDateTime = deliveryData.scheduledDateTime || 
                               (deliveryData.scheduledDate && deliveryData.scheduledTime ? 
                                `${deliveryData.scheduledDate} ${deliveryData.scheduledTime}` : '');
      const invoiceNumber = deliveryData.invoiceNumber || deliveryData.invoice || '';
      const store = deliveryData.store || deliveryData.originStore || deliveryData.location || '';
      
      functions.logger.info(`📋 Extracted webhook data:`, {
        customerName,
        customerPhone,
        address,
        scheduledDateTime,
        invoiceNumber,
        store,
        rawPhoneData: {
          customerPhone: deliveryData.customerPhone,
          clientPhone: deliveryData.clientPhone,
          phone: deliveryData.phone,
          destinationPhone: deliveryData.destinationPhone
        }
      });
      
      // Validate required fields
      if (!customerPhone || !address || !scheduledDateTime) {
        functions.logger.error(`❌ Missing required fields for delivery ${deliveryId} - Execution: ${executionId}:`, {
          customerPhone: !!customerPhone,
          address: !!address,
          scheduledDateTime: !!scheduledDateTime,
          rawData: {
            customerPhone: deliveryData.customerPhone,
            clientPhone: deliveryData.clientPhone,
            phone: deliveryData.phone,
            address: deliveryData.address,
            deliveryAddress: deliveryData.deliveryAddress,
            scheduledDate: deliveryData.scheduledDate,
            scheduledTime: deliveryData.scheduledTime,
            scheduledDateTime: deliveryData.scheduledDateTime
          }
        });
        
        // Mark as failed but don't retry
        await snap.ref.update({
          webhookSentSuccessfully: false,
          webhookError: 'Missing required fields for webhook',
          webhookErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return null;
      }
      
      // Prepare exact webhook payload
      const webhookPayload = {
        event: 'delivery_scheduled',
        deliveryId,
        customerName,
        customerPhone,
        address,
        scheduledDateTime,
        invoiceNumber,
        store,
        executionId // Add execution ID for tracking
      };
      
      functions.logger.info(`📤 Sending webhook for delivery ${deliveryId} - Execution: ${executionId}`, webhookPayload);
      
      // Send webhook using axios with 8s timeout
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        functions.logger.info(`✅ Webhook sent successfully for delivery ${deliveryId} - Execution: ${executionId}`);
        
        // Mark webhook as successfully sent
        await snap.ref.update({
          webhookSentSuccessfully: true,
          webhookSentAt: admin.firestore.FieldValue.serverTimestamp(),
          webhookResponse: response.status,
          webhookResponseData: response.data
        });
      } else {
        functions.logger.error(`❌ Webhook failed for delivery ${deliveryId}. Status: ${response.status} - Execution: ${executionId}`, response.data);
        
        // Mark as failed
        await snap.ref.update({
          webhookSentSuccessfully: false,
          webhookError: `HTTP ${response.status}: ${JSON.stringify(response.data)}`,
          webhookErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
    } catch (error) {
      // Mark as failed with error details
      try {
        await snap.ref.update({
          webhookSentSuccessfully: false,
          webhookError: error.message || 'Unknown error',
          webhookErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        functions.logger.error(`❌ Failed to update error status for delivery ${deliveryId}:`, updateError);
      }
      
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`⏰ Webhook timeout for delivery ${deliveryId} - Execution: ${executionId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`❌ Webhook failed for delivery ${deliveryId}. Status: ${error.response.status} - Execution: ${executionId}`, error.response.data);
      } else {
        functions.logger.error(`💥 Error sending webhook for delivery ${deliveryId} - Execution: ${executionId}:`, error.message);
        functions.logger.error(`💥 Full error details:`, error);
      }
      // Do not retry automatically - just log the error
    }
    
    functions.logger.info(`🏁 Function completed - Execution: ${executionId}`);
    return null;
  });

// Cloud Function that triggers when delivery status changes to "GETTING LOAD"
exports.onDeliveryStatusChanged_sendWebhook = functions.firestore
  .document('deliveries/{id}')
  .onUpdate(async (change, context) => {
    const deliveryId = context.params.id;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Generate unique execution ID for this function run
    const executionId = `${deliveryId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    functions.logger.info(`🔄 Status change function started - Execution ID: ${executionId}, Delivery: ${deliveryId}`);
    
    try {
      // Check if status changed to "GETTING LOAD" (case-insensitive)
      const beforeStatus = (beforeData.status || '').toLowerCase().trim();
      const afterStatus = (afterData.status || '').toLowerCase().trim();
      
      if (beforeStatus !== 'getting load' && afterStatus === 'getting load') {
        functions.logger.info(`🚀 Status changed to GETTING LOAD for delivery ${deliveryId} - Execution: ${executionId}`);
        
        // Use transaction to prevent duplicate webhooks
        let webhookShouldBeSent = false;
        
        await db.runTransaction(async (transaction) => {
          // Re-read the document within the transaction
          const docRef = change.after.ref;
          const freshDoc = await transaction.get(docRef);
          
          if (!freshDoc.exists) {
            functions.logger.warn(`❌ Document ${deliveryId} no longer exists, skipping webhook - Execution: ${executionId}`);
            return;
          }
          
          const freshData = freshDoc.data();
          
          // Check if webhook was already sent
          if (freshData.gettingLoadWebhookSent === true) {
            functions.logger.info(`❌ GETTING LOAD webhook already sent for delivery ${deliveryId} (detected in transaction), skipping - Execution: ${executionId}`);
            return;
          }
          
          // Mark webhook as sent atomically
          transaction.update(docRef, {
            gettingLoadWebhookSent: true,
            gettingLoadWebhookSentAt: admin.firestore.FieldValue.serverTimestamp(),
            gettingLoadWebhookExecutionId: executionId
          });
          
          webhookShouldBeSent = true;
          functions.logger.info(`✅ Transaction completed: marked GETTING LOAD webhook as sent for delivery ${deliveryId} - Execution: ${executionId}`);
        });
        
        // Only send webhook if transaction succeeded
        if (webhookShouldBeSent) {
          const webhookPayload = {
            firstName: afterData.clientName || afterData.customerName || '',
            phone: afterData.phone || afterData.customerPhone || afterData.clientPhone || '',
            address: afterData.address || afterData.deliveryAddress || '',
            invoice: afterData.invoiceNumber || '',
            status: afterData.status || ''
          };
          
          functions.logger.info(`📤 Sending GETTING LOAD webhook for delivery ${deliveryId} - Execution: ${executionId}`, webhookPayload);
          
          const response = await axios.post('https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/e74a90fe-2813-4631-93e3-f3d0aaf27968', webhookPayload, {
            timeout: 8000,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.status >= 200 && response.status < 300) {
            functions.logger.info(`✅ GETTING LOAD webhook sent successfully for delivery ${deliveryId} - Execution: ${executionId}`);
            
            // Mark as successfully sent
            await change.after.ref.update({
              gettingLoadWebhookSentSuccessfully: true,
              gettingLoadWebhookResponse: response.status,
              gettingLoadWebhookResponseData: response.data
            });
          } else {
            functions.logger.error(`❌ GETTING LOAD webhook failed for delivery ${deliveryId}. Status: ${response.status} - Execution: ${executionId}`, response.data);
            
            // Mark as failed
            await change.after.ref.update({
              gettingLoadWebhookSentSuccessfully: false,
              gettingLoadWebhookError: `HTTP ${response.status}: ${JSON.stringify(response.data)}`,
              gettingLoadWebhookErrorAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } else {
        functions.logger.info(`ℹ️ Status change detected but not GETTING LOAD (${beforeStatus} -> ${afterStatus}) for delivery ${deliveryId} - Execution: ${executionId}`);
      }
      
    } catch (error) {
      // Mark as failed with error details
      try {
        await change.after.ref.update({
          gettingLoadWebhookSentSuccessfully: false,
          gettingLoadWebhookError: error.message || 'Unknown error',
          gettingLoadWebhookErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        functions.logger.error(`❌ Failed to update error status for delivery ${deliveryId}:`, updateError);
      }
      
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`⏰ GETTING LOAD webhook timeout for delivery ${deliveryId} - Execution: ${executionId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`❌ GETTING LOAD webhook failed for delivery ${deliveryId}. Status: ${error.response.status} - Execution: ${executionId}`, error.response.data);
      } else {
        functions.logger.error(`💥 Error sending GETTING LOAD webhook for delivery ${deliveryId} - Execution: ${executionId}:`, error.message);
        functions.logger.error(`💥 Full error details:`, error);
      }
      // Do not retry automatically - just log the error
    }
    
    functions.logger.info(`🏁 Status change function completed - Execution: ${executionId}`);
    return null;
  });