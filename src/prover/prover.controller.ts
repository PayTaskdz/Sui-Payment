import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProverService } from './prover.service';
import { ProverRequestDto } from './dto/prover-request.dto';

@ApiTags('Prover')
@Controller('prover')
export class ProverController {
  constructor(private readonly proverService: ProverService) {}

  @Post('zklogin')
  @ApiOperation({ summary: 'Proxy request to zkLogin prover service' })
  @ApiBody({ type: ProverRequestDto })
  @ApiResponse({ status: 201, description: 'Proof created' })
  @ApiResponse({ status: 500, description: 'Prover request failed' })
  createZkLoginProof(@Body() dto: ProverRequestDto) {
    return this.proverService.createZkLoginProof(dto);
  }
}

