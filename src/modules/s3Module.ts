import { KafkaClient, Producer } from 'kafka-node';  // or kafkajs, depending on your setup
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';  // Use the v3 package

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  
  
  export const uploadToS3 = async (file: Express.Multer.File): Promise<string> => {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,  // Your bucket name
      Key: `documents/${Date.now()}-${file.originalname}`,  // Unique file name
      Body: file.buffer,
      ContentType: file.mimetype,
    };
  
    // Create and send the PutObjectCommand to S3
    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
  
    // Manually construct the S3 file URL
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
  };

export  const kafkaClient = new KafkaClient({ kafkaHost: process.env.KAFKA_BROKER_URL });

export const kafkaProducer = new Producer(kafkaClient);


kafkaProducer.on('ready', () => {
    console.log('Kafka Producer is connected and ready.');
  });
  
kafkaProducer.on('error', (err) => {
console.error('Error in Kafka Producer:', err);
});
  
  // Function to send messages to Kafka
export const sendMessageToKafka = async (message: any) => {
    const payloads = [
      {
        topic: 'document-topic',  // Adjust your Kafka topic name
        messages: JSON.stringify(message),
        partition: 0,
      }
    ];
  
    kafkaProducer.send(payloads, (err, data) => {
      if (err) {
        console.error('Error sending message to Kafka:', err);
      } else {
        console.log('Message sent to Kafka:', data);
      }
    });
  };


export const extractHeadersFromHtml = (htmlContent: string): any => {
    const headerRegex = /<h[1-6]>(.*?)<\/h[1-6]>/g;
    const headers = [];
    let match;
  
    while ((match = headerRegex.exec(htmlContent)) !== null) {
      headers.push(match[1]);
    }
  
    return headers;
  };