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
import { mkdirSync, openSync, readSync, closeSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
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
  const base = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  const dir = join(base, 'capsulas');
  mkdirSync(dir, { recursive: true });
  return dir;
};

/** Valida assinatura real (magic bytes) de PNG, JPEG, GIF ou WebP. */
function ehImagemValida(caminho: string): boolean {
  const buf = Buffer.alloc(12);
  const fd = openSync(caminho, 'r');
  try {
    const lidos = readSync(fd, buf, 0, 12, 0);
    if (lidos < 4) return false;
    const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const gif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    const webp =
      lidos >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP';
    return png || jpg || gif || webp;
  } finally {
    closeSync(fd);
  }
}

@Controller('capsulas')
export class CapsulasController {
  constructor(private readonly capsulas: CapsulasService) {}

  @Public()
  @Get('publico')
  listarPublico() {
    return this.capsulas.listarPublico();
  }

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
    if (!ehImagemValida(file.path)) {
      try {
        unlinkSync(file.path);
      } catch {
        // ignora erro de limpeza
      }
      throw new BadRequestException(
        'Arquivo invalido: o conteudo nao corresponde a uma imagem PNG, JPG, WebP ou GIF.',
      );
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
