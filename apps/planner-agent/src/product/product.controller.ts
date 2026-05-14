import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() body: { name: string; description: string }) {
    // Returns immediately with status: planning — decomposition happens in background
    return this.productService.create(body.name, body.description);
  }

  @Get()
  findAll() {
    return this.productService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // Fetches live job statuses from generator-agent and aggregates them
    return this.productService.findOne(id);
  }
}
