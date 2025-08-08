const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Cloud Function that triggers when a new delivery document is created
exports.onDeliveryCreated_sendWebhook = functions.firestore
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