import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // TODO: Implement JWT authentication later
    // For now, allow all requests (testing mode)
    return true;
  }
}
