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
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border-2 border-cyan-300/40 shadow-2xl shadow-cyan-300/15 p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto pointer-events-auto scrollbar-hide">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-cyan-300/25">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-300/60 to-cyan-400/60 flex items-center justify-center shadow-lg shadow-cyan-300/30">
                    <span className="text-xl">🎁</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-200 via-cyan-100 to-cyan-200 bg-clip-text text-transparent">
                      Referral Program
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Earn rewards by inviting friends</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-gray-400 hover:text-white transition-all flex items-center justify-center text-xl font-light"
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
                  <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl border border-cyan-300/15">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-all ${
                        activeTab === 'overview'
                          ? 'bg-gradient-to-r from-cyan-300/80 to-cyan-400/80 text-white shadow-lg shadow-cyan-300/20'
                          : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-all ${
                        activeTab === 'details'
                          ? 'bg-gradient-to-r from-cyan-300/80 to-cyan-400/80 text-white shadow-lg shadow-cyan-300/20'
                          : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
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
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 border border-cyan-300/25 shadow-xl">
                          <label className="block text-xs font-semibold text-cyan-200 mb-2 uppercase tracking-wide">
                            Your Referral Code
                          </label>
                          <div className="flex items-center gap-3 mb-2 bg-slate-900/50 rounded-lg px-3 py-2 border border-cyan-300/15">
                            <span className="flex-1 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-cyan-100">
                              {referralCode.referralCode || 'Loading...'}
                            </span>
                            <button
                              onClick={handleCopyCode}
                              disabled={!referralCode.referralCode}
                              className="px-4 py-2 bg-gradient-to-r from-cyan-300/70 to-cyan-400/70 hover:from-cyan-400/80 hover:to-cyan-500/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-300/20 hover:shadow-cyan-300/30 whitespace-nowrap"
                            >
                              {copiedCode ? '✓ Copied!' : 'Copy Code'}
                            </button>
                          </div>
                          {referralCode.referralLink && (
                            <div className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2 border border-cyan-300/15">
                              <p className="flex-1 text-xs text-gray-400 break-all font-mono">{referralCode.referralLink}</p>
                              <button
                                onClick={handleCopyLink}
                                className="px-4 py-2 bg-gradient-to-r from-cyan-300/70 to-cyan-400/70 hover:from-cyan-400/80 hover:to-cyan-500/80 text-white font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-300/20 hover:shadow-cyan-300/30 whitespace-nowrap"
                              >
                                {copiedLink ? '✓ Copied!' : 'Copy Link'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-6 border border-cyan-300/25 shadow-xl">
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
                                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-cyan-300/25 shadow-lg hover:shadow-cyan-300/15 transition-all">
                                  <div className="text-xs font-semibold text-cyan-200 mb-1.5 uppercase tracking-wide">Total Referrals</div>
                                  <div className="text-2xl font-black text-white">{referralCode.totalReferrals ?? 0}</div>
                                </div>
                                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-cyan-300/25 shadow-lg hover:shadow-cyan-300/15 transition-all">
                                  <div className="text-xs font-semibold text-cyan-200 mb-1.5 uppercase tracking-wide">Active Referrals</div>
                                  <div className="text-2xl font-black text-white">{referralCode.activeReferrals ?? 0}</div>
                                </div>
                                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-green-500/40 shadow-lg hover:shadow-green-500/20 transition-all">
                                  <div className="text-xs font-semibold text-green-400 mb-1.5 uppercase tracking-wide">Total Earned</div>
                                  <div className="text-2xl font-black text-green-400">{formatAmount(referralCode.totalEarned ?? '0')}</div>
                                </div>
                                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-orange-500/40 shadow-lg hover:shadow-orange-500/20 transition-all">
                                  <div className="text-xs font-semibold text-orange-400 mb-1.5 uppercase tracking-wide">From Kills</div>
                                  <div className="text-xl font-black text-orange-400">{formatAmount(referralCode.earnedFromKills ?? '0')}</div>
                                </div>
                              </div>

                          {/* Earnings Breakdown */}
                          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 border border-cyan-300/25 shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                              <span className="w-1 h-5 bg-gradient-to-b from-cyan-300 to-cyan-400 rounded-full"></span>
                              Earnings Breakdown
                            </h3>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-2.5 bg-slate-900/50 rounded-lg border border-cyan-300/15">
                                <span className="text-cyan-200 font-medium text-sm">From Kills (2% commission)</span>
                                <span className="text-orange-400 font-bold text-base">{formatAmount(referralCode.earnedFromKills ?? '0')}</span>
                              </div>
                              <div className="flex justify-between items-center p-2.5 bg-slate-900/50 rounded-lg border border-cyan-300/15">
                                <span className="text-cyan-200 font-medium text-sm">From Deaths (1% commission)</span>
                                <span className="text-red-400 font-bold text-base">{formatAmount(referralCode.earnedFromDeaths ?? '0')}</span>
                              </div>
                              <div className="border-t-2 border-cyan-300/30 pt-3 mt-3 flex justify-between items-center p-3 bg-gradient-to-r from-cyan-300/10 to-cyan-400/10 rounded-xl">
                                <span className="text-white font-bold text-base">Total</span>
                                <span className="text-green-400 font-black text-xl">{formatAmount(referralCode.totalEarned ?? '0')}</span>
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
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-cyan-400/30 shadow-lg hover:shadow-cyan-400/20 transition-all">
                          <div className="text-xs font-semibold text-cyan-300 mb-1.5 uppercase tracking-wide">Total</div>
                          <div className="text-2xl font-black text-white">{referralStats.totalReferrals}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-cyan-400/30 shadow-lg hover:shadow-cyan-400/20 transition-all">
                          <div className="text-xs font-semibold text-cyan-300 mb-1.5 uppercase tracking-wide">Active</div>
                          <div className="text-2xl font-black text-white">{referralStats.activeReferrals}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-green-500/40 shadow-lg hover:shadow-green-500/20 transition-all">
                          <div className="text-xs font-semibold text-green-400 mb-1.5 uppercase tracking-wide">Total Earned</div>
                          <div className="text-2xl font-black text-green-400">{formatAmount(referralStats.totalEarned)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-orange-500/40 shadow-lg hover:shadow-orange-500/20 transition-all">
                          <div className="text-xs font-semibold text-orange-400 mb-1.5 uppercase tracking-wide">From Kills</div>
                          <div className="text-xl font-black text-orange-400">{formatAmount(referralStats.earnedFromKills)}</div>
                        </div>
                      </div>

                      {/* Referrals List */}
                      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-cyan-400/30 shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-cyan-400/30 bg-slate-900/50">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-1 h-5 bg-gradient-to-b from-cyan-400 to-cyan-500 rounded-full"></span>
                            Referrals List
                          </h3>
                        </div>
                        {referralStats.referrals.length === 0 ? (
                          <div className="p-8 text-center">
                            <div className="text-5xl mb-3">🎯</div>
                            <p className="text-gray-400 text-base">No referrals yet</p>
                            <p className="text-gray-500 text-xs mt-1.5">Share your referral link to invite friends!</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-cyan-400/20">
                            {referralStats.referrals.map((referee: ReferralStatsItem) => (
                              <div key={referee.refereeId} className="p-4 hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400/30 to-cyan-500/30 flex items-center justify-center border border-cyan-400/40">
                                      <span className="text-base">👤</span>
                                    </div>
                                    <div>
                                      <div className="text-white font-bold text-sm">
                                        {referee.refereeDisplayName || formatWallet(referee.refereeWallet)}
                                      </div>
                                      <div className="text-xs text-gray-400 font-mono">{formatWallet(referee.refereeWallet)}</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-green-400 font-black text-lg">{formatAmount(referee.totalEarned)}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      Joined: {new Date(referee.joinedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-4 text-xs mt-2 pt-2 border-t border-cyan-400/20">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-orange-400">⚔️</span>
                                    <span className="text-cyan-300">Kills: </span>
                                    <span className="text-orange-400 font-bold">{formatAmount(referee.earnedFromKills)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-red-400">💀</span>
                                    <span className="text-cyan-300">Deaths: </span>
                                    <span className="text-red-400 font-bold">{formatAmount(referee.earnedFromDeaths)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {referralStats.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between p-3 bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-cyan-400/30">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-400/30 disabled:shadow-none"
                          >
                            ← Previous
                          </button>
                          <span className="text-cyan-300 font-semibold">
                            Page {referralStats.pagination.page} of {referralStats.pagination.totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(referralStats.pagination.totalPages, p + 1))}
                            disabled={currentPage === referralStats.pagination.totalPages}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-400/30 disabled:shadow-none"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

