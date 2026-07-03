const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow API',
      version: '2.0.0',
      description: 'Application complète de gestion de tâches avec authentification JWT, recherche fulltext, partage, commentaires, réactions et plus.',
      contact: {
        name: 'TaskFlow Team',
        url: 'https://github.com/essohlewis/essohlewis'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Développement'
      },
      {
        url: 'https://api.taskflow.app',
        description: 'Production'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token d\'accès JWT'
        }
      },
      schemas: {
        Task: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 42 },
            title: { type: 'string', example: 'Finir le rapport' },
            description: { type: 'string', example: 'Rapport trimestriel Q3' },
            status: { type: 'string', enum: ['a_faire', 'en_cours', 'terminee'], example: 'en_cours' },
            priority: { type: 'string', enum: ['basse', 'moyenne', 'haute'], example: 'haute' },
            tag: { type: 'string', example: 'travail', nullable: true },
            due_date: { type: 'string', format: 'date', example: '2024-07-15', nullable: true },
            is_archived: { type: 'boolean', example: false },
            archived_at: { type: 'string', format: 'date-time', nullable: true },
            workspace_id: { type: 'integer', nullable: true },
            subtasks_total: { type: 'integer', example: 5 },
            subtasks_done: { type: 'integer', example: 3 },
            attachments_count: { type: 'integer', example: 2 },
            comments_count: { type: 'integer', example: 1 },
            reactions: { type: 'array', items: { type: 'object' } },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 42 },
            name: { type: 'string', example: 'Jean Dupont' },
            email: { type: 'string', format: 'email', example: 'jean@example.com' },
            bio: { type: 'string', example: 'Développeur passionné', nullable: true },
            avatar: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Stats: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 25 },
            a_faire: { type: 'integer', example: 10 },
            en_cours: { type: 'integer', example: 8 },
            terminee: { type: 'integer', example: 7 },
            en_retard: { type: 'integer', example: 2 },
            taux_completion: { type: 'integer', example: 28 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'integer' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './routes/authRoutes.js',
    './routes/taskRoutes.js',
    './routes/userRoutes.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
