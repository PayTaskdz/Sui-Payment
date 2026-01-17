import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { SaveContactDto } from './dto/save-contact.dto';
import { ResolveQrDto } from './dto/resolve-qr.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * POST /contacts?userId=xxx
   * Save contact
   */
  @Post()
  async saveContact(
    @Query('userId') userId: string,
    @Body() dto: SaveContactDto,
  ) {
    return this.contactsService.saveContact(userId, dto);
  }

  /**
   * GET /contacts?userId=xxx&page=1&limit=20
   * List contacts with pagination
   */
  @Get()
  async listContacts(
    @Query('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.contactsService.listContacts(userId, pagination);
  }

  /**
   * GET /contacts/recent?userId=xxx
   * Get recent transfers
   */
  @Get('recent')
  async getRecentTransfers(@Query('userId') userId: string) {
    return this.contactsService.getRecentTransfers(userId);
  }

  /**
   * POST /contacts/resolve-qr
   * UC13: Bank QR Resolution - Lookup recipient by QR
   */
  @Post('resolve-qr')
  async resolveQr(@Body() dto: ResolveQrDto) {
    return this.contactsService.resolveQr(dto.qrString);
  }

  /**
   * DELETE /contacts/:id
   * Delete contact
   */
  @Delete(':id')
  async deleteContact(@Param('id') id: string) {
    return this.contactsService.deleteContact(id);
  }
}
