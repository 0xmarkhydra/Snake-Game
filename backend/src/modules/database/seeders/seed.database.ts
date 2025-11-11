import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  AdminConfigRepository,
  VipRoomConfigRepository,
} from '../repositories';
import { VipRoomType } from '../entities';

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(AdminConfigRepository)
  private readonly adminConfigRepository: AdminConfigRepository;

  @Inject(VipRoomConfigRepository)
  private readonly vipRoomConfigRepository: VipRoomConfigRepository;

  constructor() {}

  async onApplicationBootstrap() {
    const isWorker = Boolean(Number(process.env.IS_WORKER || 0));
    if (!isWorker) {
      return;
    }
    const start = Date.now();

    await this.seedVipRoomConfig();

    const end = Date.now();
    console.log('Time to seed database', (end - start) / 1000);

    console.log('-----------SEED DATABASE SUCCESSFULLY----------------');
  }

  private async seedVipRoomConfig(): Promise<void> {
    const existingConfig = await this.vipRoomConfigRepository.findOne({
      where: { roomType: VipRoomType.SNAKE_VIP },
    });

    if (existingConfig) {
      return;
    }

    await this.vipRoomConfigRepository.save(
      this.vipRoomConfigRepository.create({
        roomType: VipRoomType.SNAKE_VIP,
        entryFee: '1.000000',
        rewardRatePlayer: '0.900000',
        rewardRateTreasury: '0.100000',
        respawnCost: '0.000000',
        maxClients: 20,
        tickRate: 60,
        metadata: {
          description: 'Default VIP configuration',
        },
      }),
    );
  }
}
