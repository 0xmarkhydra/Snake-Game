import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { referralService, ReferralCodeResponse, ReferralStatsResponse, ReferralStatsItem } from '../services/ReferralService';

interface ReferralStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralStatsModal = ({ isOpen, onClose }: ReferralStatsModalProps) => {
  const [referralCode, setReferralCode] = useState<ReferralCodeResponse | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReferralData();
    }
  }, [isOpen, currentPage]);

  const loadReferralData = async () => {
    setIsLoading(true);
    try {
      const [codeData, statsData] = await Promise.all([
        referralService.getMyReferralCode(),
        referralService.getReferralStats(currentPage, 10),
      ]);
      console.log('Referral code data:', codeData);
      console.log('Referral stats data:', statsData);
      
      // Set referral code data
      if (codeData) {
        setReferralCode(codeData);
      }
      
      // Set stats data
      if (statsData) {
        setReferralStats(statsData);
      }
    } catch (error) {
      console.error('Failed to load referral data:', error);
      // Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (referralCode?.referralCode) {
      const success = await referralService.copyReferralLink(referralCode.referralCode);
      if (success) {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    }
  };

  const handleCopyLink = async () => {
    if (referralCode?.referralLink) {
      const success = await referralService.copyReferralLink(referralCode.referralLink);
      if (success) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.000000';
    return num.toFixed(6);
  };

  const formatWallet = (wallet: string): string => {
    if (wallet.length <= 12) return wallet;
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
            className="fixed inset-0 z-[2001] flex items-center justify-center pointer-events-none p-4"
          >
            <div className="relative bg-gray-100 backdrop-blur-md rounded-[40px] border border-gray-300/50 shadow-2xl shadow-gray-400/30 p-3 min-w-[280px] max-w-4xl max-h-[85vh] w-full overflow-y-auto pointer-events-auto scrollbar-hide">
              <div className="absolute inset-0 bg-gradient-to-br from-game-blue/10 via-transparent to-game-gold/5 animate-pulse pointer-events-none rounded-[40px]"></div>
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[32px] bg-white/80 border border-gray-200 flex items-center justify-center shadow-lg shadow-gray-300 overflow-hidden">
                      <img src="/images/gift.jpg" alt="Referral Gift" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-[#2C97FF]">Referral Program</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Earn rewards by inviting friends</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-[16px] bg-black/20 hover:bg-white text-gray-500 hover:text-gray-700 transition-all flex items-center justify-center text-lg font-semibold border border-gray-200 shadow"
                  >
                    ×
                  </button>
                </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-12 h-12 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-cyan-200 font-medium">Loading referral data...</p>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`flex-1 px-6 py-3 font-semibold rounded-[28px] transition-all ${
                        activeTab === 'overview'
                          ? 'bg-[#2C97FF] text-white shadow-lg shadow-[#2C97FF]/40'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 px-6 py-3 font-semibold rounded-[28px] transition-all ${
                        activeTab === 'details'
                          ? 'bg-[#2C97FF] text-white shadow-lg shadow-[#2C97FF]/40'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Details
                    </button>
                  </div>

                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Referral Code Section */}
                      {referralCode ? (
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-lg shadow-gray-100">
                           <label className="block text-xs font-semibold text-[#000000] mb-2 uppercase tracking-wide text-center">
                            Your Referral Code
                          </label>
                          <div className="flex items-center gap-3 mb-2 bg-white rounded-[28px] px-3 py-2 border border-gray-200">
                            <span className="flex-1 text-2xl font-black text-gray-700">
                              {referralCode.referralCode || 'Loading...'}
                            </span>
                            <button
                              onClick={handleCopyCode}
                              disabled={!referralCode.referralCode}
                              className="flex items-center justify-center px-4 py-2 min-w-[130px] bg-gradient-to-r from-[#2C97FF] to-[#5CB8FF] hover:from-[#248DEB] hover:to-[#4AA9FF] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-[24px] transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 whitespace-nowrap"
                            >
                              {copiedCode ? '✓ Copied!' : 'Copy Code'}
                            </button>
                          </div>
                          {referralCode.referralLink && (
                            <div className="flex items-center gap-3 bg-white rounded-[28px] px-3 py-2 border border-gray-200">
                              <p className="flex-1 text-xs text-gray-500 break-all font-mono">{referralCode.referralLink}</p>
                              <button
                                onClick={handleCopyLink}
                                className="flex items-center justify-center px-4 py-2 min-w-[130px] bg-gradient-to-r from-[#2C97FF] to-[#5CB8FF] hover:from-[#248DEB] hover:to-[#4AA9FF] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-[24px] transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 whitespace-nowrap"
                              >
                                {copiedLink ? '✓ Copied!' : 'Copy Link'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg shadow-gray-100">
                          <div className="text-center py-8">
                            <div className="w-12 h-12 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-cyan-200">Loading referral code...</p>
                          </div>
                        </div>
                      )}

                          {/* Stats Grid */}
                          {referralCode && (
                            <>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all text-center">
                                  <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Total Referrals</div>
                                  <div className="text-2xl font-bold text-gray-500">{referralCode.totalReferrals ?? 0}</div>
                                </div>
                                <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all text-center">
                                  <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Active Referrals</div>
                                  <div className="text-2xl font-bold text-gray-500">{referralCode.activeReferrals ?? 0}</div>
                                </div>
                                <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                  <div className="text-xs font-semibold text-[#3f7d42] mb-1.5 uppercase tracking-wide">Total Earned</div>
                                  <div className="text-2xl font-black text-[#3f7d42]">{formatAmount(referralCode.totalEarned ?? '0')}</div>
                                </div>
                                <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                  <div className="text-xs font-semibold text-[#cf6d2a] mb-1.5 uppercase tracking-wide">From Kills</div>
                                  <div className="text-xl font-black text-[#cf6d2a]">{formatAmount(referralCode.earnedFromKills ?? '0')}</div>
                                </div>
                              </div>

                          {/* Earnings Breakdown */}
                          <div className="bg-white rounded-[30px] p-5 border border-gray-200 shadow-lg shadow-gray-100">
                            <h3 className="text-lg font-bold text-[#2d261e] mb-3 text-center">
                              Earnings Breakdown
                            </h3>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-2.5 bg-[#f7f9fc] rounded-[30px] border border-[#e3e7ed]">
                                <span className="text-gray-600 font-medium text-sm">From Kills (2% commission)</span>
                                <span className="text-[#FF7A27] font-bold text-base">{formatAmount(referralCode.earnedFromKills ?? '0')}</span>
                              </div>
                              <div className="flex justify-between items-center p-2.5 bg-[#f7f9fc] rounded-[30px] border border-[#e3e7ed]">
                                <span className="text-gray-600 font-medium text-sm">From Deaths (1% commission)</span>
                                <span className="text-[#FF0000] font-bold text-base">{formatAmount(referralCode.earnedFromDeaths ?? '0')}</span>
                              </div>
                              <div className="border border-[#2c7c3d] pt-3 mt-3 flex justify-between items-center p-3 bg-[#2c7c3d] rounded-[30px]">
                                <span className="text-white font-bold text-base">Total</span>
                                <span className="text-white font-black text-xl">{formatAmount(referralCode.totalEarned ?? '0')}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Details Tab */}
                  {activeTab === 'details' && referralStats && (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all text-center">
                          <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Total</div>
                          <div className="text-2xl font-bold text-gray-600">{referralStats.totalReferrals}</div>
                        </div>
                        <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all text-center">
                          <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Active</div>
                          <div className="text-2xl font-bold text-gray-600">{referralStats.activeReferrals}</div>
                        </div>
                        <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                          <div className="text-xs font-semibold text-[#3a7740] mb-1.5 uppercase tracking-wide">Total Earned</div>
                          <div className="text-2xl font-black text-[#3a7740]">{formatAmount(referralStats.totalEarned)}</div>
                        </div>
                        <div className="bg-white rounded-[30px] p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                          <div className="text-xs font-semibold text-[#c46322] mb-1.5 uppercase tracking-wide">From Kills</div>
                          <div className="text-xl font-black text-[#c46322]">{formatAmount(referralStats.earnedFromKills)}</div>
                        </div>
                      </div>

                      {/* Referrals List */}
                      <div className="bg-white rounded-[30px] border border-gray-200 shadow-lg shadow-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-[#f7f9fc]">
                          <h3 className="text-lg font-bold text-[#182132] text-center">
                            Referrals List
                          </h3>
                        </div>
                        {referralStats.referrals.length === 0 ? (
                          <div className="p-8 text-center bg-white">
                            <div className="text-5xl mb-3">🎯</div>
                            <p className="text-gray-500 text-base">No referrals yet</p>
                            <p className="text-gray-400 text-xs mt-1.5">Share your referral link to invite friends!</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100 bg-white">
                            {referralStats.referrals.map((referee: ReferralStatsItem) => (
                              <div key={referee.refereeId} className="p-4 hover:bg-[#f8fbff] transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#bae4ff] to-[#8bc7ff] flex items-center justify-center border border-[#8fcaff]">
                                      <span className="text-base">👤</span>
                                    </div>
                                    <div>
                                      <div className="text-[#1f2430] font-bold text-sm">
                                        {referee.refereeDisplayName || formatWallet(referee.refereeWallet)}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono">{formatWallet(referee.refereeWallet)}</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[#2f7d38] font-black text-lg">{formatAmount(referee.totalEarned)}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      Joined: {new Date(referee.joinedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-4 text-xs mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#ff8a3d]">⚔️</span>
                                    <span className="text-[#2f6891]">Kills: </span>
                                    <span className="text-[#ff7a15] font-bold">{formatAmount(referee.earnedFromKills)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[#ff4d4f]">💀</span>
                                    <span className="text-[#2f6891]">Deaths: </span>
                                    <span className="text-[#e53935] font-bold">{formatAmount(referee.earnedFromDeaths)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {referralStats.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-6 py-3 bg-gradient-to-r from-[#7dc7ff] to-[#4fa5f8] hover:from-[#6bbdff] hover:to-[#3f97f2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-[#7ec4ff]/40 disabled:shadow-none"
                          >
                            ← Previous
                          </button>
                          <span className="text-[#2568a3] font-semibold">
                            Page {referralStats.pagination.page} of {referralStats.pagination.totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(referralStats.pagination.totalPages, p + 1))}
                            disabled={currentPage === referralStats.pagination.totalPages}
                            className="px-6 py-3 bg-gradient-to-r from-[#7dc7ff] to-[#4fa5f8] hover:from-[#6bbdff] hover:to-[#3f97f2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-[#7ec4ff]/40 disabled:shadow-none"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

