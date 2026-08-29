import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecipesService } from './recipes.service';

class RecipeIngredientDto {
  @IsString()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  unit!: string;
}

class CreateRecipeDto {
  @IsString()
  menuItemId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  yield?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}

class UpdateRecipeDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  yield?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];
}

@ApiTags('recipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.recipesService.findAll(organizationId);
  }

  @Get('menu-item/:menuItemId')
  findByMenuItem(
    @Param('menuItemId') menuItemId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.recipesService.findByMenuItem(menuItemId, organizationId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.recipesService.findOne(id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: CreateRecipeDto,
  ) {
    return this.recipesService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipesService.update(id, user.organizationId, user.id, dto);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.recipesService.delete(id, user.organizationId, user.id);
  }

  @Get(':id/food-cost')
  calculateFoodCost(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.recipesService.calculateFoodCost(id, organizationId, outletId);
  }
}
