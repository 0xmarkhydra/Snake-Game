import { AppDataSource } from './data-source';

AppDataSource.initialize()
  .then(async () => {
    console.log('Data Source has been initialized!');
    console.log('Running migrations...');
    const migrations = await AppDataSource.runMigrations();
    console.log(`Migrations executed: ${migrations.length}`);
    migrations.forEach((migration) => {
      console.log(`  - ${migration.name}`);
    });
    await AppDataSource.destroy();
    console.log('Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during migration:', error);
    process.exit(1);
  });

