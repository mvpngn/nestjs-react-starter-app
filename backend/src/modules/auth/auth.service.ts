import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserEntity } from '../users/models/users.entity';
import { JwtService } from '@nestjs/jwt';
import { Tokens } from './types/tokens.type';
import { RefreshTokenEntity } from './models/refreshTokens.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpiredAccessTokenEntity } from './models/expiredAccessTokens.entity';
import { ResetPasswordDto } from '../users/dto/reset-password.dto';
import { SignInUserDto } from '../users/dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(ExpiredAccessTokenEntity)
    private readonly expiredAccessTokenRepository: Repository<ExpiredAccessTokenEntity>,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signIn(userDto: SignInUserDto): Promise<Tokens> {
    const user = await this.validateUser(userDto.username, userDto.password);
    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user, tokens.refreshToken);
    return tokens;
  }

  async signUp(createUserDto: CreateUserDto): Promise<Tokens> {
    await this.usersService.validateUsername(createUserDto.username);
    const user = await this.usersService.create({
      ...createUserDto,
    });
    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user, tokens.refreshToken);
    return tokens;
  }

  async signOut(userId: number, accessToken: string, refreshToken: string) {
    await this.deleteRefreshToken(userId, refreshToken);
    await this.saveExpiredAccessToken(userId, accessToken);
    return { message: 'Successfully logged out!' };
  }

  async resetPassword(
    userId: number,
    resetPassword: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.getOne(userId);
    const isMatch = await this.usersService.isPasswordValid(
      resetPassword.oldPassword,
      user,
    );

    if (!isMatch) {
      throw new BadRequestException({
        message: 'Old password does not match!',
      });
    }

    if (resetPassword.newPassword !== resetPassword.confirmPassword) {
      throw new BadRequestException({
        message: 'Old and Confirm do not match!',
      });
    }

    await this.usersService.updatePassword(userId, resetPassword.newPassword);
    await this.deleteAllRefreshTokens(userId);
    return {
      message: 'Password updated successfully!',
    };
  }

  async fullSignOut(userId: number, accessToken: string) {
    await this.deleteAllRefreshTokens(userId);
    await this.saveExpiredAccessToken(userId, accessToken);
  }

  async refreshAccessToken(userId: number, refreshToken: string) {
    await this.deleteRefreshToken(userId, refreshToken);
    const user = await this.usersService.getOne(userId);
    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user, tokens.refreshToken);
    return tokens;
  }

  async validateUser(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    const isPasswordsEqual = await this.usersService.isPasswordValid(
      password,
      user,
    );
    if (user && isPasswordsEqual) {
      return user;
    }
    throw new ForbiddenException({
      message: 'Incorrect password or username',
    });
  }

  async updateRefreshToken(user: UserEntity, refreshToken: string) {
    // create new refresh token
    const refreshTokenDb = new RefreshTokenEntity();
    refreshTokenDb.token = refreshToken;
    refreshTokenDb.user = user;
    await this.refreshTokenRepository.save(refreshTokenDb);
  }

  async deleteRefreshToken(userId: number, refreshToken: string) {
    const foundToken = await this.refreshTokenRepository.findOne({
      where: { user: { id: userId }, token: refreshToken },
    });
    // delete old refresh token
    if (foundToken) {
      await this.refreshTokenRepository.remove(foundToken);
    } else {
      throw new ForbiddenException('Access denied!');
    }
  }

  async deleteAllRefreshTokens(userId: number) {
    const foundTokens = await this.refreshTokenRepository.find({
      where: { user: { id: userId } },
    });
    await this.refreshTokenRepository.remove(foundTokens);
  }

  async saveExpiredAccessToken(userId: number, accessToken: string) {
    const user = await this.usersService.getOne(userId);
    const createdExpiredToken = new ExpiredAccessTokenEntity();
    createdExpiredToken.user = user;
    createdExpiredToken.token = accessToken;
    await this.expiredAccessTokenRepository.save(createdExpiredToken);
  }

  async isAccessTokenExpired(userId: number, token: string): Promise<boolean> {
    const foundToken = await this.expiredAccessTokenRepository.findOne({
      where: { user: { id: userId }, token: token },
    });
    return foundToken !== undefined;
  }

  private async generateTokens(user: UserEntity): Promise<Tokens> {
    const payload = {
      id: user.id,
      username: user.username,
      password: user.password,
      roles: user.roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: `.${process.env.NODE_ENV}.${process.env.ACCESS_TOKEN_JWT_SECRET}`,
        expiresIn: '10m',
      }),
      this.jwtService.signAsync(payload, {
        secret: `.${process.env.NODE_ENV}.${process.env.REFRESH_TOKEN_JWT_SECRET}`,
        expiresIn: '30d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
