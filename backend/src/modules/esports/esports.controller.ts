import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VideoHighlightService } from './video-highlight.service';
import { GenerateHighlightDto, HighlightMetadata } from './dto/video-highlight.dto';

@ApiTags('esports')
@Controller('esports')
export class EsportsController {
  constructor(private readonly highlightService: VideoHighlightService) {}

  @Post('highlights/generate')
  @ApiOperation({
    summary: 'Generate an automated 15-second clutch video highlight clip for a battle',
  })
  @ApiResponse({ status: 201, description: 'Highlight generated successfully' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async generateHighlight(@Body() dto: GenerateHighlightDto): Promise<HighlightMetadata> {
    return this.highlightService.generateVideoHighlight(dto.battleId, dto.format);
  }

  @Get('highlights/:id')
  @ApiOperation({
    summary: 'Retrieve video highlight metadata and Open Graph tags by highlight ID',
  })
  @ApiResponse({ status: 200, description: 'Highlight metadata found' })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getHighlight(@Param('id') id: string): Promise<HighlightMetadata> {
    return this.highlightService.getHighlightById(id);
  }
}
