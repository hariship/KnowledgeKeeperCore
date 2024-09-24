import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';  // Import cors

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());  // Use the cors middleware

app.use(bodyParser.json());

app.use(bodyParser.json());
app.use('/api/v1', routes);

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'KnowledgeKeeper API',
      version: '1.0.0',
      description: 'KnowledgeKeeper API Documentation',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],  // Apply the Bearer token globally
      },
    ],
  },
  apis: ['./src/routes/*.ts'],  // Path to your API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
