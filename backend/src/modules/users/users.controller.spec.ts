import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';

describe('UsersController - Privacy & Profile Suite (#394)', () => {
  let controller: UsersController;
  let usersService: any;
  let privacyService: any;

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn().mockResolvedValue({ id: 'u1', username: 'dev1' }),
      findByUsername: jest.fn().mockResolvedValue({ id: 'u1', username: 'dev1' }),
      updateProfile: jest.fn().mockResolvedValue({ id: 'u1', name: 'New Name' }),
    };

    privacyService = {
      previewShred: jest.fn().mockResolvedValue({
        userId: 'u1',
        currentUsername: 'dev1',
        historicalBattlesPreservedCount: 5,
      }),
      shredUserAccount: jest.fn().mockResolvedValue({
        certificateNumber: 'GDPR-RTBF-2026-1234',
        status: 'CRYPTOGRAPHICALLY_SHREDDED',
      }),
      getDeletionCertificate: jest.fn().mockResolvedValue({
        certificateNumber: 'GDPR-RTBF-2026-1234',
      }),
      verifyCertificate: jest.fn().mockResolvedValue({
        isValid: true,
        certificateNumber: 'GDPR-RTBF-2026-1234',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrivacyService, useValue: privacyService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should get current user profile', async () => {
    const res = await controller.getProfile({ user: { id: 'u1' } });
    expect(res).toEqual({ id: 'u1', username: 'dev1' });
    expect(usersService.getProfile).toHaveBeenCalledWith('u1');
  });

  it('should preview GDPR cryptographic shredding', async () => {
    const res = await controller.previewShred({ user: { id: 'u1' } });
    expect(res.userId).toBe('u1');
    expect(privacyService.previewShred).toHaveBeenCalledWith('u1');
  });

  it('should execute delete account via POST /users/privacy/delete-account', async () => {
    const res = await controller.deleteAccount(
      { user: { id: 'u1' } },
      { confirmUsername: 'dev1' },
    );
    expect(res.certificateNumber).toBe('GDPR-RTBF-2026-1234');
    expect(privacyService.shredUserAccount).toHaveBeenCalledWith('u1', {
      confirmUsername: 'dev1',
    });
  });

  it('should execute delete account via DELETE /users/account', async () => {
    const res = await controller.deleteAccountRest(
      { user: { id: 'u1' } },
      { confirmUsername: 'dev1' },
    );
    expect(res.status).toBe('CRYPTOGRAPHICALLY_SHREDDED');
    expect(privacyService.shredUserAccount).toHaveBeenCalledWith('u1', {
      confirmUsername: 'dev1',
    });
  });

  it('should retrieve GDPR certificate by ID', async () => {
    const res = await controller.getCertificate('GDPR-RTBF-2026-1234');
    expect(res.certificateNumber).toBe('GDPR-RTBF-2026-1234');
    expect(privacyService.getDeletionCertificate).toHaveBeenCalledWith('GDPR-RTBF-2026-1234');
  });

  it('should verify certificate signature', async () => {
    const res = await controller.verifyCertificate({
      certificateNumber: 'GDPR-RTBF-2026-1234',
    });
    expect(res.isValid).toBe(true);
    expect(privacyService.verifyCertificate).toHaveBeenCalledWith({
      certificateNumber: 'GDPR-RTBF-2026-1234',
    });
  });

  it('should get public profile by username', async () => {
    const res = await controller.getPublicProfile('dev1');
    expect(res.username).toBe('dev1');
    expect(usersService.findByUsername).toHaveBeenCalledWith('dev1');
  });
});

