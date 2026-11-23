import { IsArray, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class IndexCodeFileDto {
  @IsString()
  repositoryId!: string;

  @IsString()
  filePath!: string;

  @IsString()
  sourceCode!: string;
}

export class IndexRepositoryCodeDto {
  @IsString()
  repositoryId!: string;

  @IsArray()
  files!: Array<{ filePath: string; sourceCode: string }>;
}

export class SemanticCodeSearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  repositoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  topK?: number;
}
