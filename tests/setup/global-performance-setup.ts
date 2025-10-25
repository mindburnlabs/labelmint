// Global performance test setup
export default async function setup() {
  console.log('🔧 Setting up performance test environment...');

  // Any global setup needed for performance tests
  return async () => {
    console.log('🧹 Cleaning up performance test environment...');
  };
}