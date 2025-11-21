import { AppDataSource } from '../src/modules/database/data-source';
import { UserEntity } from '../src/modules/database/entities/user.entity';

async function checkReferralUser() {
  const userId = '7c64f9ad-e4d6-4489-8edc-23be85e11369';
  
  await AppDataSource.initialize();
  
  try {
    // Check user with raw query
    const userRaw = await AppDataSource
      .createQueryBuilder()
      .select(['user.id', 'user.referred_by_id', 'user.referral_code'])
      .from(UserEntity, 'user')
      .where('user.id = :userId', { userId })
      .getRawOne();
    
    console.log('Raw query result:', userRaw);
    
    // Check user with entity
    const user = await AppDataSource.getRepository(UserEntity).findOne({
      where: { id: userId },
      relations: ['referredBy'],
    });
    
    console.log('Entity query result:', {
      id: user?.id,
      referralCode: user?.referralCode,
      referredById: user?.referredById,
      referredBy: user?.referredBy ? {
        id: user.referredBy.id,
        referralCode: user.referredBy.referralCode,
      } : null,
    });
    
    // Check referral rewards
    const rewards = await AppDataSource.query(
      `SELECT * FROM referral_rewards WHERE referee_id = $1`,
      [userId]
    );
    
    console.log('Referral rewards for this user:', rewards);
    
    // Check transactions for referrer
    const referrerId = userRaw?.user_referred_by_id || user?.referredById;
    if (referrerId) {
      const transactions = await AppDataSource.query(
        `SELECT * FROM transactions WHERE user_id = $1 AND metadata->>'reward_type' = 'game_commission' ORDER BY created_at DESC LIMIT 10`,
        [referrerId]
      );
      
      console.log('Referral commission transactions for referrer:', transactions);
      
      // Check wallet balance of referrer
      const referrerBalance = await AppDataSource.query(
        `SELECT * FROM wallet_balances WHERE user_id = $1`,
        [referrerId]
      );
      
      console.log('Referrer wallet balance:', referrerBalance);
    } else {
      console.log('User has no referrer (referred_by_id is null)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

checkReferralUser();

