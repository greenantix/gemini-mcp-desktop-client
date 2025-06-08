// Test file to trigger TypeScript errors for testing
interface TestInterface {
  name: string;
  age: number;
}

function testFunction(data: TestInterface) {
  // This will cause a TypeScript error
  console.log(data.nonExistentProperty);
  
  // This will be detected as a debug log
  console.log("Debug: testing the system");
  
  // TODO: This should be detected as a todo item
  return data.name;
}

// Unused variable (should be detected)
const unusedVariable = "test";

export { testFunction };
