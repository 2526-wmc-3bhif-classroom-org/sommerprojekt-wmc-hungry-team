import neo4j from 'neo4j';

let driver = null;

export const getNeo4jDriver = () => {
  if (!driver) {
    const protocol = process.env.NEO4J_PROTOCOL || 'bolt';
    const host = process.env.NEO4J_HOST || 'localhost';
    const port = process.env.NEO4J_BOLT_PORT || '7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    const connectionString = `${protocol}://${host}:${port}`;
    
    console.log(`Connecting to Neo4j at ${connectionString}`);
    
    driver = neo4j.driver(
      connectionString,
      neo4j.auth.basic(user, password),
      {
        maxConnectionPoolSize: 50,
        connectionTimeout: 10000,
        disableLosslessIntegers: true
      }
    );
  }
  return driver;
};

export const getNeo4jSession = () => {
  return getNeo4jDriver().session({ database: 'neo4j' });
};

export const closeNeo4j = async () => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};

export default { getNeo4jDriver, getNeo4jSession, closeNeo4j };

