const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
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
    
    // Early check: If webhook already sent, skip immediately
    if (deliveryData.scheduledWebhookSent === true) {
      functions.logger.info(`Webhook already sent for delivery ${deliveryId}, skipping`);
      return null;
    }
    
    try {
      // Pre-check: If status exists and is not PENDING, skip
      if (deliveryData.status && deliveryData.status !== 'PENDING') {
        functions.logger.info(`Delivery ${deliveryId} status is not PENDING (${deliveryData.status}), skipping webhook`);
        return null;
      }
      
      // Use transaction to prevent duplicate sends
      await db.runTransaction(async (transaction) => {
        // Re-read the document within the transaction
        const docRef = snap.ref;
        const freshDoc = await transaction.get(docRef);
        
        if (!freshDoc.exists) {
          functions.logger.warn(`Document ${deliveryId} no longer exists, skipping webhook`);
          return;
        }
        
        const freshData = freshDoc.data();
        
        // Check again if webhook was already sent
        if (freshData.scheduledWebhookSent === true) {
          functions.logger.info(`Webhook already sent for delivery ${deliveryId} (detected in transaction), skipping`);
          return;
        }
        
        // Set the flag before sending webhook
        transaction.update(docRef, {
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Transaction completed: marked webhook as sent for delivery ${deliveryId}`);
      });
      
      // Extract fields with sensible fallbacks
      const customerName = deliveryData.customerName || '';
      const customerPhone = deliveryData.customerPhone || deliveryData.destinationPhone || deliveryData.phone || '';
      const address = deliveryData.address || '';
      const scheduledDateTime = deliveryData.scheduledDateTime || deliveryData.scheduledAt || '';
      const invoiceNumber = deliveryData.invoiceNumber || deliveryData.invoice || '';
      const store = deliveryData.store || deliveryData.location || '';
      
      // Validate required fields
      if (!customerPhone || !address || !scheduledDateTime) {
        functions.logger.warn(`Missing required fields for delivery ${deliveryId}:`, {
          customerPhone: !!customerPhone,
          address: !!address,
          scheduledDateTime: !!scheduledDateTime
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
        store
      };
      
      functions.logger.info(`Sending webhook for delivery ${deliveryId}`, webhookPayload);
      
      // Send webhook using axios with 8s timeout
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        functions.logger.info(`Webhook sent successfully for delivery ${deliveryId}`);
      } else {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response:`, response.data);
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`Webhook timeout for delivery ${deliveryId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${error.response.status}, Response:`, error.response.data);
      } else {
        functions.logger.error(`Error sending webhook for delivery ${deliveryId}:`, error.message);
      }
      // Do not retry automatically - just log the error
    }
    
    return null;
  });

// Cloud Function that triggers when a new delivery document is created
exports.onDeliveryCreated_sendWebhook = functions.firestore
  .document('deliveries/{id}')
  .onCreate(async (snap, context) => {
    const deliveryId = context.params.id;
    const deliveryData = snap.data();
    
    try {
      // Pre-check: If webhook already sent, skip
      if (deliveryData.scheduledWebhookSent === true) {
        functions.logger.info(`Webhook already sent for delivery ${deliveryId}, skipping`);
        return null;
      }
      
      // Pre-check: If status exists and is not PENDING, skip
      if (deliveryData.status && deliveryData.status !== 'PENDING') {
        functions.logger.info(`Delivery ${deliveryId} status is not PENDING (${deliveryData.status}), skipping webhook`);
        return null;
      }
      
      // Validate required fields
      const customerName = deliveryData.customerName || deliveryData.clientName;
      const customerPhone = deliveryData.customerPhone || deliveryData.destinationPhone || deliveryData.phone;
      const address = deliveryData.address || deliveryData.deliveryAddress;
      const scheduledDateTime = deliveryData.scheduledDateTime || `${deliveryData.scheduledDate || ''} ${deliveryData.scheduledTime || ''}`.trim();
      const invoiceNumber = deliveryData.invoiceNumber;
      const store = deliveryData.store || deliveryData.originStore;
      
      if (!customerName || !customerPhone || !address || !scheduledDateTime || !invoiceNumber) {
        functions.logger.warn(`Missing required fields for delivery ${deliveryId}:`, {
          customerName: !!customerName,
          customerPhone: !!customerPhone,
          address: !!address,
          scheduledDateTime: !!scheduledDateTime,
          invoiceNumber: !!invoiceNumber
        });
        return null;
      }
      
      // Prepare exact webhook payload
      const webhookPayload = {
        deliveryId,
        customerName,
        customerPhone,
        address,
        scheduledDateTime,
        invoiceNumber,
        store
      };
      
      functions.logger.info(`Sending webhook for delivery ${deliveryId}`, webhookPayload);
      
      // Send webhook using axios with 8s timeout
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        // Update document to mark webhook as sent
        await snap.ref.update({
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Webhook sent successfully for delivery ${deliveryId}`);
      } else {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response:`, response.data);
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`Webhook timeout for delivery ${deliveryId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${error.response.status}, Response:`, error.response.data);
      } else {
        functions.logger.error(`Error sending webhook for delivery ${deliveryId}:`, error.message);
      }
      // Do not retry automatically - just log the error
    }
    
    return null;
  });

// Legacy webhook function (keeping existing functionality)
exports.onDeliveryStatusChanged_sendWebhook = functions.firestore
  .document('deliveries/{id}')
  .onUpdate(async (change, context) => {
    const deliveryId = context.params.id;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    try {
      // Check if status changed to "GETTING LOAD"
      if (beforeData.status !== 'GETTING LOAD' && afterData.status === 'GETTING LOAD') {
        functions.logger.info(`Status changed to GETTING LOAD for delivery ${deliveryId}`);
        
        const webhookPayload = {
          firstName: afterData.clientName || afterData.customerName || '',
          phone: afterData.phone || afterData.customerPhone || '',
          address: afterData.address || afterData.deliveryAddress || '',
          invoice: afterData.invoiceNumber || '',
          status: afterData.status || ''
        };
        
        functions.logger.info(`Sending status change webhook for delivery ${deliveryId}`, webhookPayload);
        
        const response = await axios.post('https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/e74a90fe-2813-4631-93e3-f3d0aaf27968', webhookPayload, {
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status >= 200 && response.status < 300) {
          functions.logger.info(`Status change webhook sent successfully for delivery ${deliveryId}`);
        } else {
          functions.logger.error(`Status change webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response:`, response.data);
        }
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`Status change webhook timeout for delivery ${deliveryId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`Status change webhook failed for delivery ${deliveryId}. Status: ${error.response.status}, Response:`, error.response.data);
      } else {
        functions.logger.error(`Error sending status change webhook for delivery ${deliveryId}:`, error.message);
      }
    }
    
    return null;
  });

// Alternative legacy function name for backward compatibility
exports.onDeliveryCreated_sendWebhook_legacy = functions.firestore
  .document('deliveries/{id}')
  .onCreate(async (snap, context) => {
    const deliveryId = context.params.id;
    const deliveryData = snap.data();
    
    try {
      // Check if this is a PENDING delivery
      if (!deliveryData.status || deliveryData.status.toLowerCase() !== 'pending') {
        functions.logger.info(`Delivery ${deliveryId} is not PENDING (status: ${deliveryData.status}), skipping webhook`);
        return null;
      }
      
      // Check if webhook was already sent
      if (deliveryData.scheduledWebhookSent === true) {
        functions.logger.info(`Webhook already sent for delivery ${deliveryId}, skipping`);
        return null;
      }
      
      // Prepare webhook payload
      const webhookPayload = {
        deliveryId: deliveryId,
        customerName: deliveryData.clientName || deliveryData.customerName || '',
        customerPhone: deliveryData.phone || deliveryData.customerPhone || deliveryData.destinationPhone || '',
        address: deliveryData.address || deliveryData.deliveryAddress || '',
        scheduledDateTime: deliveryData.scheduledDateTime || `${deliveryData.scheduledDate || ''} ${deliveryData.scheduledTime || ''}`.trim(),
        invoiceNumber: deliveryData.invoiceNumber || '',
        store: deliveryData.originStore || deliveryData.store || ''
      };
      
      functions.logger.info(`Sending webhook for delivery ${deliveryId}`, webhookPayload);
      
      // Send webhook
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        // Update document to mark webhook as sent
        await snap.ref.update({
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Webhook sent successfully for delivery ${deliveryId}`);
      } else {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response:`, response.data);
      }
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        functions.logger.error(`Webhook timeout for delivery ${deliveryId}:`, error.message);
      } else if (error.response) {
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response:`, error.response.data);
      } else {
        functions.logger.error(`Error sending webhook for delivery ${deliveryId}:`, error.message);
      }
      // Do not retry automatically - just log the error
    }
    
    return null;
  });

// Keep existing function for backward compatibility
exports.legacyWebhookFunction = functions.firestore
  .document('deliveries/{id}')
  .onCreate(async (snap, context) => {
    const deliveryId = context.params.id;
    const deliveryData = snap.data();
    
    try {
      // Check if this is a PENDING delivery
      if (!deliveryData.status || deliveryData.status.toLowerCase() !== 'pending') {
        functions.logger.info(`Delivery ${deliveryId} is not PENDING (status: ${deliveryData.status}), skipping webhook`);
        return null;
      }
      
      // Check if webhook was already sent
      if (deliveryData.scheduledWebhookSent === true) {
        functions.logger.info(`Webhook already sent for delivery ${deliveryId}, skipping`);
        return null;
      }
      
      // Prepare webhook payload
      const webhookPayload = {
        deliveryId: deliveryId,
        customerName: deliveryData.clientName || deliveryData.customerName || '',
        customerPhone: deliveryData.phone || deliveryData.customerPhone || deliveryData.destinationPhone || '',
        address: deliveryData.address || deliveryData.deliveryAddress || '',
        scheduledDateTime: deliveryData.scheduledDateTime || `${deliveryData.scheduledDate || ''} ${deliveryData.scheduledTime || ''}`.trim(),
        invoiceNumber: deliveryData.invoiceNumber || '',
        store: deliveryData.originStore || deliveryData.store || ''
      };
      
      functions.logger.info(`Sending webhook for delivery ${deliveryId}`, webhookPayload);
      
      // Send webhook
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      if (response.ok) {
        // Update document to mark webhook as sent
        await snap.ref.update({
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Webhook sent successfully for delivery ${deliveryId}`);
      } else {
        const errorText = await response.text();
        functions.logger.error(`Webhook failed for delivery ${deliveryId}. Status: ${response.status}, Response: ${errorText}`);
      }
      
    } catch (error) {
      functions.logger.error(`Error sending webhook for delivery ${deliveryId}:`, error);
      // Do not retry automatically - just log the error
    }
    
    return null;
  });