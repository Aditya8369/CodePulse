import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ReviewFileDto {
  @ApiProperty()
  @IsString()
  filePath: string;

  @ApiProperty()
  @IsString()
  content: string;
}

export class ReviewCommitRequestDto {
  @ApiProperty({ description: 'Git commit SHA hash to analyze' })
  @IsString()
  @IsNotEmpty()
  commitSha: string;

  @ApiPropertyOptional({ description: 'GitHub repository in format owner/repo' })
  @IsString()
  @IsOptional()
  repository?: string;

  @ApiPropertyOptional({ description: 'GitHub API token' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ description: 'Explicit list of files and contents to scan', type: [ReviewFileDto] })
  @IsArray()
  @IsOptional()
  files?: ReviewFileDto[];
}
