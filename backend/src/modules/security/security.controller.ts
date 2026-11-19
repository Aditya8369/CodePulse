import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TyposquatScannerService } from './typosquat-scanner.service';
import {
  ScanPackageDto,
  ScanResultDto,
  ScanSinglePackageDto,
  TypoSquatFinding,
} from './dto/scan-package.dto';

@ApiTags('security')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly typosquatScannerService: TyposquatScannerService,
  ) {}

  @Post('scan-dependencies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan dependency manifest for typo-squatting, homoglyphs, and dependency confusion attacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns risk severity score and install authorization status',
    type: ScanResultDto,
  })
  async scanDependencies(
    @Body() dto: ScanPackageDto,
  ): Promise<ScanResultDto> {
    return this.typosquatScannerService.scanDependencies(
      dto.dependencies,
      dto.protectedNamespaces,
    );
  }

  @Post('scan-package')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a single package dependency for typosquatting and confusion risk',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns detailed risk evaluation for the single package',
  })
  async scanSinglePackage(
    @Body() dto: ScanSinglePackageDto,
  ): Promise<TypoSquatFinding> {
    return this.typosquatScannerService.scanPackage({
      name: dto.name,
      ecosystem: dto.ecosystem,
      version: dto.version,
    });
  }
}
