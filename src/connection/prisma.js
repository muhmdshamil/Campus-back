import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});



const connectDB = async () => {
  try {
    console.log('Attempting to connect to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection test successful');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
    process.exit(1);
  }
};
 export { connectDB, disconnectDB };
 export default prisma;
