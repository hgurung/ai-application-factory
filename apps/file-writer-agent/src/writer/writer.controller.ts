import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WriterService } from './writer.service';

@Controller('write')
export class WriterController {
  constructor(private readonly writerService: WriterService) {}

  // Called by generator-agent's job processor after a job passes validation
  @Post()
  write(@Body() body: { productId: string; moduleName: string; code: string }) {
    return this.writerService.write(body.productId, body.moduleName, body.code);
  }

  // List all files written for a product — useful for the dashboard
  @Get(':productId')
  listOutput(@Param('productId') productId: string) {
    return this.writerService.listOutput(productId);
  }
}
