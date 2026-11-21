import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import {
  AtivarCapsulaDto,
  AtualizarCapsulaDto,
  CriarCapsulaDto,
} from './capsulas.dto';
import { CapsulasService } from './capsulas.service';

const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const pastaCapsulas = () => {
  const dir = join(process.cwd(), 'uploads', 'capsulas');
  mkdirSync(dir, { recursive: true });
  return dir;
};

@Controller('capsulas')
export class CapsulasController {
  constructor(private readonly capsulas: CapsulasService) {}

  @Get()
  listar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query('ativos') ativos?: string,
  ) {
    return this.capsulas.listar(usuario, ativos === 'true');
  }

  @Roles('ADMIN')
  @Post('upload-imagem')
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, pastaCapsulas()),
        filename: (_req, file, cb) => {
          const ext = MIME_EXT[file.mimetype] || extname(file.originalname).toLowerCase() || '.png';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!MIME_EXT[file.mimetype]) {
          return cb(
            new BadRequestException('Formato invalido. Envie PNG, JPG, WebP ou GIF.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadImagem(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de imagem enviado.');
    }
    return { imagemUrl: `/uploads/capsulas/${file.filename}` };
  }

  @Roles('ADMIN')
  @Post()
  criar(@Body() dto: CriarCapsulaDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.capsulas.criar(dto, usuario);
  }

  @Roles('ADMIN')
  @Put(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarCapsulaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.capsulas.atualizar(id, dto, usuario);
  }

  @Roles('ADMIN')
  @Patch(':id/ativo')
  definirAtivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtivarCapsulaDto,
  ) {
    return this.capsulas.definirAtivo(id, dto.ativo);
  }

  @Roles('ADMIN')
  @Get(':id/historico-precos')
  historico(@Param('id', ParseIntPipe) id: number) {
    return this.capsulas.historicoPrecos(id);
  }
}
