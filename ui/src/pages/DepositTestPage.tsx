import '../polyfills/node';
import { useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, VaultSDK } from '@solana-payment/sdk';

const prettify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value ?? '');
  }
};

const defaultWebhookPayload = `{
  "event": {
    "signature": "example-signature",
    "slot": 420122255,
    "blockTime": 1762592529,
    "eventType": "DepositEvent",
    "success": true,
    "data": {
      "user": "WALLET_ADDRESS",
      "amount": "1000000"
    }
  },
  "timestamp": 1762601253479,
  "indexerVersion": "1.0.0"
}`;

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: PublicKey;
      connect: () => Promise<{ publicKey: PublicKey }>;
      disconnect?: () => Promise<void>;
      signTransaction?: (transaction: any) => Promise<any>;
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        publicKey?: PublicKey;
        connect: () => Promise<{ publicKey: PublicKey }>;
        disconnect?: () => Promise<void>;
        signTransaction?: (transaction: any) => Promise<any>;
      };
    };
  }
}

const DEFAULT_RPC = 'https://api.devnet.solana.com';

const getPhantomProvider = () => {
  if (typeof window !== 'undefined') {
    return (window.solana as any) || (window.phantom?.solana as any) || null;
  }
  return null;
};

const DepositTestPage = () => {
  const defaultBaseUrl = useMemo(
    () => import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:2567',
    [],
  );
  const defaultRpcUrl = useMemo(
    () => import.meta.env.VITE_SOLANA_RPC_URL || DEFAULT_RPC,
    [],
  );

  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [rpcUrl, setRpcUrl] = useState(defaultRpcUrl);
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('1');
  const [metadata, setMetadata] = useState<{
    raw: Record<string, unknown>;
    payload: Record<string, unknown>;
    tokenMint: string;
    decimals: number;
    amount: number;
  } | null>(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookPayload, setWebhookPayload] = useState(defaultWebhookPayload);
  const [log, setLog] = useState('');
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const metadataDisplay = useMemo(
    () => (metadata ? prettify({ metadata: metadata.raw, payload: metadata.payload }) : ''),
    [metadata],
  );

  useEffect(() => {
    setPhantomAvailable(Boolean(getPhantomProvider()?.isPhantom));
    document.body.classList.add('deposit-test-body');
    return () => {
      document.body.classList.remove('deposit-test-body');
    };
  }, []);

  const appendLog = (message: string, data?: unknown, error?: boolean) => {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data,
      level: error ? 'ERROR' : 'INFO',
    };
    setLog((prev) => `${entry.level} ${prettify(entry)}\n\n${prev}`.trim());
    if (error) {
      try {
        alert(`${entry.message} \n${prettify(entry.data)}`);
      } catch (alertError) {
        console.warn('Failed to show alert', alertError);
      }
    }
  };

  const fetchJSON = async (
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> => {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw { status: response.status, data: json };
    }
    return json;
  };

  const copyText = async (content: string, context: string) => {
    try {
      await navigator.clipboard.writeText(content);
      appendLog(`Copied ${context} to clipboard`);
    } catch (error) {
      appendLog(`Failed to copy ${context}`, error, true);
    }
  };

  const handleConnectWallet = async () => {
    const provider = getPhantomProvider();
    appendLog('Phantom provider check', {
      available: Boolean(provider),
      isPhantom: provider?.isPhantom,
      hasConnect: typeof provider?.connect === 'function',
    });
    if (!provider?.isPhantom || typeof provider.connect !== 'function') {
      appendLog(
        'Phantom wallet not detected. Vui lòng cài extension và reload trang.',
        provider,
        true,
      );
      return;
    }

    try {
      setConnectingWallet(true);
      const response = await provider.connect();
      const publicKey = response.publicKey?.toString?.() ?? String(response.publicKey);
      setWalletPublicKey(publicKey);
      if (!walletAddress) {
        setWalletAddress(publicKey);
      }
      appendLog('Phantom wallet connected', { publicKey });
    } catch (error: any) {
      appendLog(
        'Failed to connect Phantom wallet',
        { message: error?.message ?? error, stack: error?.stack },
        true,
      );
    } finally {
      setConnectingWallet(false);
    }
  };

  const handleCreateDeposit = async () => {
    if (!walletAddress.trim()) {
      appendLog('Wallet address is required', undefined, true);
      return;
    }

    const inputAmount = Number(amount);
    if (!inputAmount || inputAmount <= 0) {
      appendLog('Amount must be greater than 0', { amount }, true);
      return;
    }

    try {
      const result = await fetchJSON('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: walletAddress.trim(), amount: inputAmount }),
      });
      const payload = ((result as any)?.data ?? result) as Record<string, unknown>;
      const rawMetadata = (payload.metadata ?? payload) as Record<string, unknown>;
      const tokenMint = String(rawMetadata.tokenMint ?? rawMetadata.mint ?? '');
      const decimalsValue = Number(
        rawMetadata.decimals ?? rawMetadata.decimal ?? payload.decimals ?? payload.decimal ?? 6,
      );
      const metadataAmountValue = Number(
        rawMetadata.amount ??
          rawMetadata.value ??
          rawMetadata.rawAmount ??
          rawMetadata.formattedAmount ??
          payload.amount ??
          payload.value ??
          payload.rawAmount ??
          payload.formattedAmount ??
          amount,
      );
      const normalized = {
        raw: rawMetadata,
        payload,
        tokenMint,
        decimals: Number.isNaN(decimalsValue) ? 6 : decimalsValue,
        amount: Number.isNaN(metadataAmountValue) ? inputAmount : metadataAmountValue,
      };
      setMetadata(normalized);
      appendLog('Deposit metadata received', normalized);
    } catch (error: any) {
      appendLog(
        'Create deposit failed',
        { message: error?.message ?? error, stack: error?.stack, details: error?.data },
        true,
      );
    }
  };

  const handleSendWithSdk = async () => {
    if (!metadata) {
      appendLog('Run step ① to fetch metadata first', undefined, true);
      return;
    }

    const provider = getPhantomProvider();
    appendLog('Preparing to send transaction', {
      providerAvailable: Boolean(provider),
      hasPublicKey: Boolean(provider?.publicKey),
      hasSignTransaction: Boolean(provider?.signTransaction),
    });
    if (!provider?.publicKey || !provider.signTransaction) {
      appendLog(
        'Phantom wallet not connected or missing capabilities',
        provider,
        true,
      );
      return;
    }

    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const sdk = new VaultSDK({
        connection,
        programId: PROGRAM_ID,
      });

      const mintAddress = metadata.tokenMint;
      const numericAmount = metadata.amount;
      const decimals = metadata.decimals;

      appendLog('Metadata amount parsing', {
        metadataAmountRaw:
          metadata.raw.amount ??
          metadata.raw.value ??
          metadata.raw.rawAmount ??
          metadata.payload?.amount ??
          (metadata.payload?.['metadata'] as Record<string, unknown> | undefined)?.['amount'] ??
          metadata.amount,
        numericAmount,
        decimals,
      });

      if (!mintAddress || Number.isNaN(numericAmount)) {
        appendLog('Metadata missing tokenMint or amount', metadata, true);
        return;
      }

      const mint = new PublicKey(mintAddress);
      const rawAmount = Math.round(numericAmount * 10 ** decimals);

      appendLog('SDK deposit parameters', {
        mintAddress,
        decimals,
        amount: numericAmount,
        rawAmount,
      });

      const transaction = await sdk.buildDepositTransaction({
        amount: rawAmount,
        user: provider.publicKey,
        mint,
      });

      transaction.feePayer = provider.publicKey;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      appendLog('Transaction built', {
        feePayer: transaction.feePayer?.toString(),
        recentBlockhash: transaction.recentBlockhash,
      });

      const signed = await provider.signTransaction(transaction);
      appendLog('Transaction signed', { signatures: transaction.signatures.map((sig) => sig.publicKey.toString()) });
      const signature = await connection.sendRawTransaction(signed.serialize());
      appendLog('Transaction submitted', { signature });
      await connection.confirmTransaction(signature, 'confirmed');

      appendLog('SDK deposit transaction confirmed', { signature });
    } catch (error: any) {
      appendLog(
        'SDK deposit transaction failed',
        { message: error?.message ?? error, stack: error?.stack },
        true,
      );
    }
  };

  const handleSendWebhook = async () => {
    try {
      const headers = webhookSecret.trim()
        ? { 'x-webhook-secret': webhookSecret.trim() }
        : undefined;
      const result = await fetchJSON('/webhook/deposit', {
        method: 'POST',
        headers,
        body: webhookPayload,
      });
      appendLog('Webhook sent successfully', result);
    } catch (error) {
      appendLog('Send webhook failed', error, true);
    }
  };

  const handleClearLog = () => setLog('');

  return (
    <div className="deposit-test">
      <header className="deposit-test__hero">
        <h1>Deposit Test Playground</h1>
        <p>
          Công cụ mini để mô phỏng luồng nạp credit: sinh metadata, gửi giao dịch qua SDK và thử
          webhook.
        </p>
      </header>

      <section className="card">
        <h2>⚙️ Cấu hình chung</h2>
        <label>
          Backend Base URL
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value.replace(/\/$/, ''))}
            placeholder="http://localhost:2567"
          />
        </label>
        <small>Điều chỉnh nếu backend chạy ở host/cổng khác.</small>

        <label>
          RPC Endpoint
          <input
            value={rpcUrl}
            onChange={(event) => setRpcUrl(event.target.value)}
            placeholder={DEFAULT_RPC}
          />
        </label>
        <small>
          Endpoint RPC Solana dùng khi ký giao dịch bằng SDK (nên trùng với mạng của ví).
        </small>

        <label>
          Wallet Address
          <input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="Ví người dùng (ví dụ: 7L5Q3s5j...)"
          />
        </label>
        <small>
          Địa chỉ ví này sẽ được gửi lên <code>/wallet/deposit</code> để sinh metadata và dùng cho
          webhook test.
        </small>
      </section>

      <section className="card">
        <h2>① Gọi <code>/wallet/deposit</code></h2>
        <label>
          Số lượng token muốn nạp
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min="0.000001"
            step="0.000001"
            placeholder="Nhập số lượng (ví dụ 10)"
          />
        </label>
        <small>
          Endpoint chỉ cần <code>walletAddress</code> và <code>amount</code>, không yêu cầu JWT.
        </small>
        <div className="actions">
          <button type="button" onClick={handleCreateDeposit}>
            Tạo metadata deposit
          </button>
          <button
            type="button"
            onClick={() => metadataDisplay && copyText(metadataDisplay, 'metadata')}
            disabled={!metadata}
          >
            Copy metadata
          </button>
        </div>
        <label>
          Metadata trả về
          <textarea
            readOnly
            rows={6}
            value={metadataDisplay}
            placeholder="Metadata sẽ xuất hiện ở đây"
          />
        </label>
      </section>

      <section className="card">
        <h2>② Gửi giao dịch số với SDK</h2>
        <p>
          Bước này dùng Phantom để ký giao dịch tạo bởi <code>@solana-payment/sdk</code>. Bạn cần
          chắc chắn vault đã được initialize trước đó.
        </p>
        <div className="actions">
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={!phantomAvailable || connectingWallet}
          >
            {phantomAvailable ? 'Kết nối Phantom' : 'Phantom chưa cài đặt'}
          </button>
          <button
            type="button"
            onClick={handleSendWithSdk}
            disabled={!metadata || !walletPublicKey || !phantomAvailable}
          >
            Gửi transaction (SDK)
          </button>
        </div>
        <small>
          Trạng thái ví:{' '}
          {phantomAvailable
            ? walletPublicKey
              ? `Đã kết nối (${walletPublicKey})`
              : 'Chưa kết nối'
            : 'Không phát hiện Phantom (hãy dùng Chrome và cài extension)'}
        </small>
        {metadata && (
          <small>
            Metadata đã chuẩn hóa: mint {metadata.tokenMint || 'N/A'}, amount {metadata.amount}, decimals{' '}
            {metadata.decimals}
          </small>
        )}
        <pre className="code-block">
{`# Nếu muốn test qua script NodeJS thay vì trình duyệt
pnpm ts-node docs/task/deposit/deposit.ts`}
        </pre>
      </section>

      <section className="card">
        <h2>③ Gửi webhook giả lập</h2>
        <label>
          Payload JSON
          <textarea
            rows={10}
            value={webhookPayload}
            onChange={(event) => setWebhookPayload(event.target.value)}
          />
        </label>
        <small>
          Thay <code>WALLET_ADDRESS</code> bằng ví thực tế. Nếu backend cấu hình secret, điền vào ô
          bên dưới.
        </small>
        <label>
          Webhook Secret (optional)
          <input
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
            placeholder="Ví dụ: 123"
          />
        </label>
        <div className="actions">
          <button type="button" onClick={handleSendWebhook}>
            Gửi webhook test
          </button>
        </div>
      </section>

      <section className="card">
        <h2>📜 Nhật ký</h2>
        <div className="actions">
          <button type="button" onClick={handleClearLog}>
            Xóa log
          </button>
          <button
            type="button"
            onClick={() => log && copyText(log, 'log entries')}
            disabled={!log}
          >
            Copy log
          </button>
        </div>
        <pre className="log-viewer">{log}</pre>
        <small>
          Để kiểm tra credit sau khi webhook chạy, dùng Postman/curl gọi
          <code>/wallet/credit</code> kèm JWT.
        </small>
      </section>
    </div>
  );
};

export default DepositTestPage;
