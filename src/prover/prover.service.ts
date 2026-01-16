import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProverRequestDto } from './dto/prover-request.dto';

@Injectable()
export class ProverService {
  constructor(private readonly config: ConfigService) {}

  async createZkLoginProof(payload: ProverRequestDto) {
    const baseUrl = this.config.get<string>('ZKLOGIN_PROVER_FE_URL') ?? 'http://localhost:8082';
    const url = `${baseUrl.replace(/\/$/, '')}/v1`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PROVER_REQUEST_FAILED:${res.status}:${text}`);
    }

    return res.json();
  }
}

