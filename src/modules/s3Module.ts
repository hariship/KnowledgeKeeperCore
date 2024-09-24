import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';  // AWS S3 SDK
import amqp from 'amqplib/callback_api';  // RabbitMQ client for Node.js
import { RABBIT_MQ } from '../utils/constants';

// S3 client setup
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

// Function to upload file to S3
export const uploadToS3 = async (file: Express.Multer.File, clientName: string): Promise<string> => {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,  // Your bucket name
      Key: `${clientName}/${file.originalname}`,  // Unique file name
      Body: file.buffer,
      ContentType: file.mimetype,
    };
  
    // Create and send the PutObjectCommand to S3
    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
  
    // Manually construct the S3 file URL
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
};

// RabbitMQ setup
export const connectToRabbitMQ = (callback: (channel: amqp.Channel) => void) => {
  amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost', (err, connection) => {
    if (err) {
      throw new Error(`Error connecting to RabbitMQ: ${err}`);
    }
    connection.createChannel((err, channel) => {
      if (err) {
        throw new Error(`Error creating channel: ${err}`);
      }
      callback(channel);
    });
  });
};

// Function to send messages to RabbitMQ
export const sendMessageToRabbitMQ = async (message: any) => {
  connectToRabbitMQ(async(channel) => {
    const queue = RABBIT_MQ.DOCUMENT_UPLOADED;  // Your RabbitMQ queue name
    await channel.assertQueue(queue, { durable: true });

    const msgBuffer = Buffer.from(JSON.stringify(message));
    await channel.sendToQueue(queue, msgBuffer, { persistent: true });

    console.log(`Message sent to RabbitMQ queue "${queue}":`, message);
  });
};

// Function to extract headers from HTML content
export const extractHeadersFromHtml = (htmlContent: string): any => {
    const headerRegex = /<h[1-6]>(.*?)<\/h[1-6]>/g;
    const headers = [];
    let match;

    while ((match = headerRegex.exec(htmlContent)) !== null) {
      headers.push(match[1]);
    }

    return headers;
};