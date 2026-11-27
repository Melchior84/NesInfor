import { Global, Module } from '@nestjs/common';
import { AuthDbService } from './auth-db.service';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService, AuthDbService],
  exports: [DatabaseService, AuthDbService],
})
export class DatabaseModule {}
