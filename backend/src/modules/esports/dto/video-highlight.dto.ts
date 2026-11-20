import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VideoHighlightFormat {
  VERTICAL = 'VERTICAL',     // 1080x1920 (reels/shorts/tiktok)
  HORIZONTAL = 'HORIZONTAL', // 1920x1080 (landscape/twitter/discord)
}

export class GenerateHighlightDto {
  @ApiProperty({ description: 'ID of the battle to generate a highlight reel for' })
  @IsString()
  @IsNotEmpty()
  battleId: string;

  @ApiProperty({
    description: 'Video format / aspect ratio',
    enum: VideoHighlightFormat,
    default: VideoHighlightFormat.HORIZONTAL,
    required: false,
  })
  @IsEnum(VideoHighlightFormat)
  @IsOptional()
  format?: VideoHighlightFormat;
}

export interface HighlightMetadata {
  highlightId: string;
  battleId: string;
  videoUrl: string;
  format: VideoHighlightFormat;
  dimensions: { width: number; height: number };
  durationSeconds: number;
  openGraph: {
    title: string;
    description: string;
    videoUrl: string;
    cardType: string;
    mimeType: string;
  };
  winner: {
    username: string;
    clutchTimeRemainingMs: number;
  };
  opponent: {
    username: string;
  };
  createdAt: string;
}
