export interface paths {
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get your merchant */
        get: operations["getMerchant"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List sandbox assets */
        get: operations["listAssets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/balances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read ledger balances */
        get: operations["listBalances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List customers */
        get: operations["listCustomers"];
        put?: never;
        /** Create a sandbox customer */
        post: operations["createCustomer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a customer */
        get: operations["getCustomer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}/instruments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List customer instruments */
        get: operations["listInstruments"];
        put?: never;
        /** Create a verified sandbox instrument */
        post: operations["createInstrument"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Quote an asset conversion */
        post: operations["createQuote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a quote */
        get: operations["getQuote"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/intents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List and filter intents */
        get: operations["listIntents"];
        put?: never;
        /** Reserve funds and create an intent */
        post: operations["createIntent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/intents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read intent state and history */
        get: operations["getIntent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/intents/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel an unsent intent */
        post: operations["cancelIntent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List immutable events */
        get: operations["listEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhook_endpoints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List endpoints without secrets */
        get: operations["listWebhookEndpoints"];
        put?: never;
        /** Register a signed webhook */
        post: operations["createWebhookEndpoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhook_endpoints/{id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Disable a webhook endpoint */
        post: operations["disableWebhookEndpoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhook_deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect recent webhook deliveries */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events/{id}/replay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Replay a stable event ID */
        post: operations["replayEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/routing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Compare Nigerian sandbox routes using current health and capacity */
        get: operations["getNetworkRouting"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a merchant-scoped sandbox provider-health scenario */
        post: operations["recordNetworkHealth"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read sandbox participants and corridor capacity */
        get: operations["getNetwork"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read owned frozen route plans */
        get: operations["listNetworkPlans"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/plans/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect per-leg evidence and journals */
        get: operations["getNetworkPlan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Freeze a Nigerian sandbox route quote */
        post: operations["createNetworkQuote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/network/intents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reserve and execute a frozen multi-leg route */
        post: operations["createNetworkIntent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read staging and production readiness gates */
        get: operations["getControls"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read immutable staging review evidence */
        get: operations["listControlEvidence"];
        put?: never;
        /** Record an enrolled operator staging review */
        post: operations["createControlEvidence"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read policy approval requests */
        get: operations["listControlApprovals"];
        put?: never;
        /** Request a capped staging policy change */
        post: operations["createControlApproval"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read daily ledger and receipt control snapshots */
        get: operations["listDailyReports"];
        put?: never;
        /** Run daily controls without claiming cash reconciliation */
        post: operations["createDailyReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read immutable operator audit events */
        get: operations["listControlAudit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/approvals/{id}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review a request as another enrolled operator */
        post: operations["reviewControlApproval"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/controls/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pause new money movement and retain evidence recovery */
        post: operations["pausePayments"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/rails": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read local provider configuration */
        get: operations["getRailStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/banks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List supported NGN banks */
        get: operations["listBanks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/bank_resolutions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve a bank account name */
        post: operations["resolveBank"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}/bank_accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List verified domestic bank accounts */
        get: operations["listBankAccounts"];
        put?: never;
        /** Register a name-enquired Paystack recipient */
        post: operations["createBankAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/local_payouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reserve NGN and queue a domestic bank payout */
        post: operations["createLocalPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/local_payouts/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Queue verified payout status including late returns */
        post: operations["verifyLocalPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/collections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned collections */
        get: operations["listCollections"];
        put?: never;
        /** Queue a test collection checkout */
        post: operations["createCollection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/collections/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read collection status and checkout */
        get: operations["getCollection"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/collections/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Queue authoritative collection verification */
        post: operations["verifyCollection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/collections/{id}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Release a verified compliance-held collection */
        post: operations["releaseCollection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}/compliance_decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read sandbox compliance decisions */
        get: operations["listComplianceDecisions"];
        put?: never;
        /** Record a sandbox compliance decision */
        post: operations["setComplianceDecision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/operations/statements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned snapshot reconciliation runs */
        get: operations["listStatements"];
        put?: never;
        /** Queue reconciliation of a provider ledger snapshot */
        post: operations["createStatement"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/operations/statements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read reconciliation with unowned rows redacted */
        get: operations["getStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/stellar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read exact Testnet asset and treasury configuration */
        get: operations["getStellarStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}/stellar_challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get wallet ownership challenge */
        get: operations["getStellarChallenge"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/customers/{id}/stellar_accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned Testnet wallets */
        get: operations["listStellarAccounts"];
        put?: never;
        /** Verify wallet ownership and exact issuer trustline */
        post: operations["createStellarAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/stellar/purchases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reserve NGN and queue KUSD Testnet delivery at fixture FX */
        post: operations["createStellarPurchase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/stellar/deposits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned verified Testnet deposits */
        get: operations["listStellarDeposits"];
        put?: never;
        /** Credit a verified Testnet deposit exactly once */
        post: operations["verifyStellarDeposit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/stellar/redemptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List fixture liquidity redemptions */
        get: operations["listStellarRedemptions"];
        put?: never;
        /** Convert credited KUSD into fixture NGN liquidity */
        post: operations["redeemStellarBalance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/console/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read actual sandbox volume and ledger totals */
        get: operations["getOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api_keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List keys without secrets */
        get: operations["listApiKeys"];
        put?: never;
        /** Create a scoped API key */
        post: operations["createApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api_keys/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke a scoped key */
        post: operations["revokeApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/request_logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect redacted API request metadata */
        get: operations["listRequestLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/operations/reconciliation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect owned reconciliation items */
        get: operations["listReconciliation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/operations/intents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Inspect instructions, receipts and journals */
        get: operations["getOperationDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/operations/intents/{id}/recover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Queue safe status recovery */
        post: operations["recoverIntent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** NetworkRouting */
        NetworkRouting: {
            /** @enum {string} */
            mode: "sandbox";
            /** @enum {string} */
            strategy: "healthy_then_acceptance_then_latency_then_priority";
            amount_minor: string;
            evaluated_at: string;
            window_seconds: number;
            selected_corridor_id: string | null;
            candidates: {
                corridor_id: string;
                destination_participant_id: string;
                priority: number;
                eligible: boolean;
                reason: string | null;
                capacity_minor: string;
                available_minor: string;
                health: {
                    participant_id: string;
                    provider_binding: string;
                    /** @enum {string} */
                    status: "healthy" | "degraded" | "unavailable" | "unknown";
                    /** @enum {string} */
                    source: "simulator_registry" | "receipt_measurement" | "operator_simulation";
                    samples: number;
                    confirmed: number;
                    rejected: number;
                    failure_rate_ppm: number;
                    latency_ms: number | null;
                    observed_at: string;
                    expires_at: string;
                }[];
            }[];
        };
        /** NetworkHealthObservation */
        NetworkHealthObservation: {
            id: string;
            merchant_id: string;
            participant_id: string;
            provider_binding: string;
            /** @enum {string} */
            status: "healthy" | "degraded" | "unavailable";
            reason: string;
            actor_key_id: string;
            observed_at: string;
            expires_at: string;
            /** @enum {string} */
            mode: "sandbox";
            /** @enum {string} */
            source: "operator_simulation";
        };
        /** NetworkRegistry */
        NetworkRegistry: {
            /** @enum {string} */
            mode: "sandbox";
            /** @enum {boolean} */
            external_validated: false;
            participants: {
                id: string;
                name: string;
                country: string;
                role: string;
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                provider_binding: string;
                enabled: boolean;
                /** @enum {string} */
                mode: "sandbox";
                /** @enum {boolean} */
                external_validated: false;
            }[];
            corridors: {
                id: string;
                /** @enum {string} */
                source_asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                /** @enum {string} */
                destination_asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                origin_id: string;
                settlement_id: string;
                destination_id: string;
                enabled: boolean;
                capacity_minor: string;
                allocated_minor: string;
                available_minor: string;
                /** @enum {string} */
                mode: "sandbox";
            }[];
        };
        /** NetworkQuote */
        NetworkQuote: {
            id: string;
            plan_id: string;
            source: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            destination: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            fee: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            route: {
                position: number;
                name: string;
                participant_id: string;
                provider_binding: string;
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
                rail: string;
            }[];
            expires_at: string;
            /** @enum {string} */
            mode: "sandbox";
            /** @enum {string} */
            settlement_mode: "simulated";
            routing: {
                /** @enum {string} */
                mode: "sandbox";
                /** @enum {string} */
                strategy: "healthy_then_acceptance_then_latency_then_priority";
                amount_minor: string;
                evaluated_at: string;
                window_seconds: number;
                selected_corridor_id: string | null;
                candidates: {
                    corridor_id: string;
                    destination_participant_id: string;
                    priority: number;
                    eligible: boolean;
                    reason: string | null;
                    capacity_minor: string;
                    available_minor: string;
                    health: {
                        participant_id: string;
                        provider_binding: string;
                        /** @enum {string} */
                        status: "healthy" | "degraded" | "unavailable" | "unknown";
                        /** @enum {string} */
                        source: "simulator_registry" | "receipt_measurement" | "operator_simulation";
                        samples: number;
                        confirmed: number;
                        rejected: number;
                        failure_rate_ppm: number;
                        latency_ms: number | null;
                        observed_at: string;
                        expires_at: string;
                    }[];
                }[];
            } | null;
        };
        /** NetworkPlanList */
        NetworkPlanList: {
            data: {
                id: string;
                quote_id: string;
                corridor_id: string;
                created_at: string;
            }[];
        };
        /** NetworkPlan */
        NetworkPlan: {
            id: string;
            quote_id: string;
            intent_id: string | null;
            corridor_id: string;
            capacity_state: string | null;
            scenario: string;
            snapshot: {
                /** @enum {string} */
                mode: "sandbox";
                /** @enum {string} */
                settlement_mode: "simulated";
                source_minor: string;
                destination_minor: string;
                fee_minor: string;
                legs: {
                    position: number;
                    name: string;
                    participant_id: string;
                    provider_binding: string;
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                    rail: string;
                }[];
                routing?: {
                    /** @enum {string} */
                    mode: "sandbox";
                    /** @enum {string} */
                    strategy: "healthy_then_acceptance_then_latency_then_priority";
                    amount_minor: string;
                    evaluated_at: string;
                    window_seconds: number;
                    selected_corridor_id: string | null;
                    candidates: {
                        corridor_id: string;
                        destination_participant_id: string;
                        priority: number;
                        eligible: boolean;
                        reason: string | null;
                        capacity_minor: string;
                        available_minor: string;
                        health: {
                            participant_id: string;
                            provider_binding: string;
                            /** @enum {string} */
                            status: "healthy" | "degraded" | "unavailable" | "unknown";
                            /** @enum {string} */
                            source: "simulator_registry" | "receipt_measurement" | "operator_simulation";
                            samples: number;
                            confirmed: number;
                            rejected: number;
                            failure_rate_ppm: number;
                            latency_ms: number | null;
                            observed_at: string;
                            expires_at: string;
                        }[];
                    }[];
                };
            };
            legs: {
                id: string;
                position: number;
                participant_id: string;
                provider_binding: string;
                request: {
                    position: number;
                    name: string;
                    participant_id: string;
                    provider_binding: string;
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                    rail: string;
                };
                state: string;
                provider_reference: string | null;
                outcome: string | null;
                payload: unknown;
                journal_id: string | null;
                receipt_at: string | null;
            }[];
            /** @enum {string} */
            mode: "sandbox";
            /** @enum {boolean} */
            external_validated: false;
            created_at: string;
        };
        /** ControlStatus */
        ControlStatus: {
            /** @enum {string} */
            state: "sandbox" | "staging_active" | "paused";
            revision: number;
            policy: {
                caps: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    per_transaction_minor: string;
                    per_day_minor: string;
                }[];
            };
            /** @enum {string} */
            mode: "staging";
            /** @enum {boolean} */
            live_ready: false;
            /** @enum {string} */
            operator_enrollment: "platform_managed";
            operator_id: string | null;
            gates: {
                kind: string;
                status: string;
                evidence_id: string | null;
            }[];
            daily_report_id: string | null;
            daily_controls_clean: boolean;
            /** @enum {boolean} */
            provider_cash_complete: false;
            staging_ready: boolean;
        };
        /** ControlEvidence */
        ControlEvidence: {
            id: string;
            customer_id: string | null;
            kind: string;
            outcome: string;
            /** @enum {string} */
            mode: "staging";
            reference: string;
            reason: string;
            operator_id: string;
            expires_at: string;
            created_at: string;
        };
        /** ControlEvidenceList */
        ControlEvidenceList: {
            data: {
                id: string;
                customer_id: string | null;
                kind: string;
                outcome: string;
                /** @enum {string} */
                mode: "staging";
                reference: string;
                reason: string;
                operator_id: string;
                expires_at: string;
                created_at: string;
            }[];
        };
        /** ControlApproval */
        ControlApproval: {
            id: string;
            action: string;
            policy: {
                caps: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    per_transaction_minor: string;
                    per_day_minor: string;
                }[];
            };
            base_revision: number;
            reason: string;
            requested_by: string;
            /** @enum {string} */
            state: "pending" | "approved" | "rejected";
            reviewed_by: string | null;
            review_reason: string | null;
            expires_at: string;
            created_at: string;
            reviewed_at: string | null;
        };
        /** ControlApprovalList */
        ControlApprovalList: {
            data: {
                id: string;
                action: string;
                policy: {
                    caps: {
                        /** @enum {string} */
                        asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                        per_transaction_minor: string;
                        per_day_minor: string;
                    }[];
                };
                base_revision: number;
                reason: string;
                requested_by: string;
                /** @enum {string} */
                state: "pending" | "approved" | "rejected";
                reviewed_by: string | null;
                review_reason: string | null;
                expires_at: string;
                created_at: string;
                reviewed_at: string | null;
            }[];
        };
        /** ControlReport */
        ControlReport: {
            id: string;
            day: string;
            control_clean: boolean;
            /** @enum {string} */
            scope: "ledger_and_receipt_controls";
            /** @enum {boolean} */
            provider_cash_complete: false;
            data: {
                [key: string]: unknown;
            };
            created_at: string;
        };
        /** ControlReportList */
        ControlReportList: {
            data: {
                id: string;
                day: string;
                control_clean: boolean;
                /** @enum {string} */
                scope: "ledger_and_receipt_controls";
                /** @enum {boolean} */
                provider_cash_complete: false;
                data: {
                    [key: string]: unknown;
                };
                created_at: string;
            }[];
        };
        /** ControlAuditList */
        ControlAuditList: {
            data: {
                id: string;
                actor_key_id: string;
                operator_id: string | null;
                action: string;
                resource_id: string;
                data: {
                    [key: string]: unknown;
                };
                created_at: string;
            }[];
        };
        /** ControlPause */
        ControlPause: {
            /** @enum {string} */
            state: "paused";
            revision: number;
        };
        /** StellarStatus */
        StellarStatus: {
            /** @enum {string} */
            provider: "stellar-testnet";
            /** @enum {string} */
            network: "testnet";
            configured: boolean;
            /** @enum {string} */
            asset_code: "KUSD";
            asset_name: string;
            issuer: string | null;
            treasury: string | null;
            /** @enum {string} */
            fx_basis: "fixture_1600_ngn_per_kusd";
            /** @enum {boolean} */
            partner_fx_configured: false;
        };
        /** StellarChallenge */
        StellarChallenge: {
            challenge_hex: string;
            address: string;
        };
        /** StellarAccount */
        StellarAccount: {
            instrument_id: string;
            customer_id: string;
            address: string;
            issuer: string;
            /** @enum {string} */
            network: "testnet";
            /** @enum {string} */
            asset_code: "KUSD";
            created_at: string;
        };
        /** StellarAccountList */
        StellarAccountList: {
            data: {
                instrument_id: string;
                customer_id: string;
                address: string;
                issuer: string;
                /** @enum {string} */
                network: "testnet";
                /** @enum {string} */
                asset_code: "KUSD";
                created_at: string;
            }[];
        };
        /** StellarDeposit */
        StellarDeposit: {
            id: string;
            customer_id: string;
            instrument_id: string;
            transaction_hash: string;
            amount_minor: string;
            journal_id: string;
            evidence: {
                [key: string]: unknown;
            };
            created_at: string;
        };
        /** StellarDepositList */
        StellarDepositList: {
            data: {
                id: string;
                customer_id: string;
                instrument_id: string;
                transaction_hash: string;
                amount_minor: string;
                journal_id: string;
                evidence: {
                    [key: string]: unknown;
                };
                created_at: string;
            }[];
        };
        /** StellarRedemption */
        StellarRedemption: {
            id: string;
            hold_id: string;
            source_minor: string;
            destination_minor: string;
            journal_id: string;
            /** @enum {string} */
            rate_basis: "fixture_1600_ngn_per_kusd";
            created_at: string;
        };
        /** StellarRedemptionList */
        StellarRedemptionList: {
            data: {
                id: string;
                hold_id: string;
                source_minor: string;
                destination_minor: string;
                journal_id: string;
                /** @enum {string} */
                rate_basis: "fixture_1600_ngn_per_kusd";
                created_at: string;
            }[];
        };
        /** Error */
        Error: {
            error: {
                type: string;
                code: string;
                message: string;
                request_id: string;
            };
        };
        /** Collection */
        Collection: {
            id: string;
            /** @enum {string} */
            object: "collection";
            customer_id: string;
            amount_minor: string;
            /** @enum {string} */
            asset: "NGN";
            /** @enum {string} */
            provider: "paystack-test";
            provider_reference: string;
            /** @enum {string} */
            state: "processing" | "pending" | "unknown" | "succeeded" | "failed" | "held";
            fee_minor: string | null;
            credited_minor: string | null;
            checkout_url: string | null;
            last_error: string | null;
            created_at: string;
            updated_at: string;
            /** @enum {string} */
            mode: "sandbox";
        };
        /** CollectionList */
        CollectionList: {
            data: {
                id: string;
                /** @enum {string} */
                object: "collection";
                customer_id: string;
                amount_minor: string;
                /** @enum {string} */
                asset: "NGN";
                /** @enum {string} */
                provider: "paystack-test";
                provider_reference: string;
                /** @enum {string} */
                state: "processing" | "pending" | "unknown" | "succeeded" | "failed" | "held";
                fee_minor: string | null;
                credited_minor: string | null;
                checkout_url: string | null;
                last_error: string | null;
                created_at: string;
                updated_at: string;
                /** @enum {string} */
                mode: "sandbox";
            }[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** BankResolution */
        BankResolution: {
            id: string;
            bank_code: string;
            account_last4: string;
            account_name: string;
            expires_at: string;
            created_at: string;
        };
        /** BankAccount */
        BankAccount: {
            instrument_id: string;
            customer_id: string;
            recipient_code: string;
            bank_code: string;
            account_last4: string;
            account_name: string;
            created_at: string;
        };
        /** BankAccountList */
        BankAccountList: {
            data: {
                instrument_id: string;
                customer_id: string;
                recipient_code: string;
                bank_code: string;
                account_last4: string;
                account_name: string;
                created_at: string;
            }[];
        };
        /** BankList */
        BankList: {
            data: {
                name: string;
                code: string;
                active: boolean;
                currency: string;
            }[];
        };
        /** RailStatus */
        RailStatus: {
            /** @enum {string} */
            provider: "paystack-test";
            /** @enum {string} */
            mode: "test";
            configured: boolean;
            capabilities: string[];
            /** @enum {string} */
            asset: "NGN";
        };
        /** CollectionRecovery */
        CollectionRecovery: {
            collection_id: string;
            queued: boolean;
        };
        /** ComplianceDecision */
        ComplianceDecision: {
            id: string;
            customer_id: string;
            /** @enum {string} */
            decision: "allow" | "hold";
            reason: string;
            created_at: string;
        };
        /** ComplianceList */
        ComplianceList: {
            data: {
                id: string;
                customer_id: string;
                /** @enum {string} */
                decision: "allow" | "hold";
                reason: string;
                created_at: string;
            }[];
        };
        /** Statement */
        Statement: {
            id: string;
            /** @enum {string} */
            state: "running" | "matched" | "review" | "failed";
            matched: number;
            unmatched: number;
            /** @enum {string} */
            scope: "provider_ledger_snapshot";
            created_at: string;
            completed_at: string | null;
        };
        /** StatementList */
        StatementList: {
            data: {
                id: string;
                /** @enum {string} */
                state: "running" | "matched" | "review" | "failed";
                matched: number;
                unmatched: number;
                /** @enum {string} */
                scope: "provider_ledger_snapshot";
                created_at: string;
                completed_at: string | null;
            }[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** StatementDetail */
        StatementDetail: {
            id: string;
            /** @enum {string} */
            state: "running" | "matched" | "review" | "failed";
            matched: number;
            unmatched: number;
            /** @enum {string} */
            scope: "provider_ledger_snapshot";
            created_at: string;
            completed_at: string | null;
            items: {
                id: string;
                provider_row_id: string;
                resource_id: string;
                difference_minor: string;
                expected_minor: string | null;
                /** @enum {string} */
                state: "matched" | "mismatch";
                evidence: {
                    [key: string]: unknown;
                };
            }[];
            redacted_unmapped: number;
        };
        /** Customer */
        Customer: {
            id: string;
            name: string;
            /** @enum {string} */
            verification_state: "sandbox_verified" | "held";
            created_at: string;
        } & {
            [key: string]: unknown;
        };
        /** Instrument */
        Instrument: {
            id: string;
            customer_id: string;
            /** @enum {string} */
            type: "bank_account" | "mobile_money" | "stellar_account";
            /** @enum {string} */
            asset: "NGN" | "KES" | "GHS" | "USDC";
            label: string;
            sandbox_identifier: string;
            verified: boolean;
            created_at: string;
        } & {
            [key: string]: unknown;
        };
        /** Intent */
        Intent: {
            id: string;
            /** @enum {string} */
            object: "intent";
            /** @enum {string} */
            provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
            /** @enum {string} */
            type: "transfer" | "asset_purchase" | "asset_redemption";
            /** @enum {string} */
            state: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
            /** @enum {string} */
            compliance_state: "sandbox_allowed" | "held";
            quote_id: string;
            source: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            destination: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
                instrument_id: string;
            };
            fee: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            customer_id: string;
            reference: string;
            route: {
                name: string;
                rail: string;
                asset: string;
            }[];
            created_at: string;
            updated_at: string;
            /** @enum {string} */
            mode: "sandbox";
            history?: {
                state: string;
                detail: string;
                created_at: string;
            }[];
        };
        /** Quote */
        Quote: {
            id: string;
            /** @enum {string} */
            object: "quote";
            /** @enum {string} */
            provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
            source: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            destination: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            fee: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                amount_minor: string;
            };
            route: {
                name: string;
                rail: string;
                asset: string;
            }[];
            expires_at: string;
            created_at: string;
            /** @enum {string} */
            mode: "sandbox";
        };
        /** Event */
        Event: {
            id: string;
            type: string;
            intent_id: string | null;
            data: {
                id: string;
                /** @enum {string} */
                object: "intent";
                /** @enum {string} */
                provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
                /** @enum {string} */
                type: "transfer" | "asset_purchase" | "asset_redemption";
                /** @enum {string} */
                state: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
                /** @enum {string} */
                compliance_state: "sandbox_allowed" | "held";
                quote_id: string;
                source: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                destination: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                    instrument_id: string;
                };
                fee: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                customer_id: string;
                reference: string;
                route: {
                    name: string;
                    rail: string;
                    asset: string;
                }[];
                created_at: string;
                updated_at: string;
                /** @enum {string} */
                mode: "sandbox";
                history?: {
                    state: string;
                    detail: string;
                    created_at: string;
                }[];
            } | {
                id: string;
                /** @enum {string} */
                object: "collection";
                customer_id: string;
                amount_minor: string;
                /** @enum {string} */
                asset: "NGN";
                /** @enum {string} */
                provider: "paystack-test";
                provider_reference: string;
                /** @enum {string} */
                state: "processing" | "pending" | "unknown" | "succeeded" | "failed" | "held";
                fee_minor: string | null;
                credited_minor: string | null;
                checkout_url: string | null;
                last_error: string | null;
                created_at: string;
                updated_at: string;
                /** @enum {string} */
                mode: "sandbox";
            } | {
                id: string;
                customer_id: string;
                instrument_id: string;
                transaction_hash: string;
                amount_minor: string;
                journal_id: string;
                evidence: {
                    [key: string]: unknown;
                };
                created_at: string;
            } | {
                id: string;
                hold_id: string;
                source_minor: string;
                destination_minor: string;
                journal_id: string;
                /** @enum {string} */
                rate_basis: "fixture_1600_ngn_per_kusd";
                created_at: string;
            };
            created_at: string;
        } & {
            [key: string]: unknown;
        };
        /** WebhookEndpoint */
        WebhookEndpoint: {
            id: string;
            url: string;
            active: boolean;
            created_at?: string;
            secret?: string;
        };
        /** WebhookDelivery */
        WebhookDelivery: {
            id: string;
            endpoint_id: string;
            event_id: string;
            /** @enum {string} */
            state: "pending" | "delivered" | "failed";
            attempts: number;
            status_code: number | null;
            last_error: string | null;
            next_attempt_at: string;
        };
        /** ApiKey */
        ApiKey: {
            id: string;
            name: string;
            prefix: string;
            scopes: string[];
            created_at: string;
            revoked_at: string | null;
        };
        /** CustomerList */
        CustomerList: {
            data: ({
                id: string;
                name: string;
                /** @enum {string} */
                verification_state: "sandbox_verified" | "held";
                created_at: string;
            } & {
                [key: string]: unknown;
            })[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** InstrumentList */
        InstrumentList: {
            data: ({
                id: string;
                customer_id: string;
                /** @enum {string} */
                type: "bank_account" | "mobile_money" | "stellar_account";
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC";
                label: string;
                sandbox_identifier: string;
                verified: boolean;
                created_at: string;
            } & {
                [key: string]: unknown;
            })[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** IntentList */
        IntentList: {
            data: {
                id: string;
                /** @enum {string} */
                object: "intent";
                /** @enum {string} */
                provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
                /** @enum {string} */
                type: "transfer" | "asset_purchase" | "asset_redemption";
                /** @enum {string} */
                state: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
                /** @enum {string} */
                compliance_state: "sandbox_allowed" | "held";
                quote_id: string;
                source: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                destination: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                    instrument_id: string;
                };
                fee: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                customer_id: string;
                reference: string;
                route: {
                    name: string;
                    rail: string;
                    asset: string;
                }[];
                created_at: string;
                updated_at: string;
                /** @enum {string} */
                mode: "sandbox";
                history?: {
                    state: string;
                    detail: string;
                    created_at: string;
                }[];
            }[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** EventList */
        EventList: {
            data: ({
                id: string;
                type: string;
                intent_id: string | null;
                data: {
                    id: string;
                    /** @enum {string} */
                    object: "intent";
                    /** @enum {string} */
                    provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
                    /** @enum {string} */
                    type: "transfer" | "asset_purchase" | "asset_redemption";
                    /** @enum {string} */
                    state: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
                    /** @enum {string} */
                    compliance_state: "sandbox_allowed" | "held";
                    quote_id: string;
                    source: {
                        /** @enum {string} */
                        asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                        amount_minor: string;
                    };
                    destination: {
                        /** @enum {string} */
                        asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                        amount_minor: string;
                        instrument_id: string;
                    };
                    fee: {
                        /** @enum {string} */
                        asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                        amount_minor: string;
                    };
                    customer_id: string;
                    reference: string;
                    route: {
                        name: string;
                        rail: string;
                        asset: string;
                    }[];
                    created_at: string;
                    updated_at: string;
                    /** @enum {string} */
                    mode: "sandbox";
                    history?: {
                        state: string;
                        detail: string;
                        created_at: string;
                    }[];
                } | {
                    id: string;
                    /** @enum {string} */
                    object: "collection";
                    customer_id: string;
                    amount_minor: string;
                    /** @enum {string} */
                    asset: "NGN";
                    /** @enum {string} */
                    provider: "paystack-test";
                    provider_reference: string;
                    /** @enum {string} */
                    state: "processing" | "pending" | "unknown" | "succeeded" | "failed" | "held";
                    fee_minor: string | null;
                    credited_minor: string | null;
                    checkout_url: string | null;
                    last_error: string | null;
                    created_at: string;
                    updated_at: string;
                    /** @enum {string} */
                    mode: "sandbox";
                } | {
                    id: string;
                    customer_id: string;
                    instrument_id: string;
                    transaction_hash: string;
                    amount_minor: string;
                    journal_id: string;
                    evidence: {
                        [key: string]: unknown;
                    };
                    created_at: string;
                } | {
                    id: string;
                    hold_id: string;
                    source_minor: string;
                    destination_minor: string;
                    journal_id: string;
                    /** @enum {string} */
                    rate_basis: "fixture_1600_ngn_per_kusd";
                    created_at: string;
                };
                created_at: string;
            } & {
                [key: string]: unknown;
            })[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** EndpointList */
        EndpointList: {
            data: {
                id: string;
                url: string;
                active: boolean;
                created_at?: string;
                secret?: string;
            }[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** KeyList */
        KeyList: {
            data: {
                id: string;
                name: string;
                prefix: string;
                scopes: string[];
                created_at: string;
                revoked_at: string | null;
            }[];
            has_more: boolean;
            next_cursor: string | null;
        };
        /** BalanceList */
        BalanceList: {
            data: {
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                purpose: string;
                minor: string;
            }[];
            /** @enum {string} */
            mode: "sandbox";
        };
        /** AssetList */
        AssetList: {
            data: {
                /** @enum {string} */
                id: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                code: string;
                name: string;
                scale: number;
                country: string;
                flag: string;
                /** @enum {string} */
                kind: "fiat" | "stellar";
                rail: string;
                network?: string;
                issuer?: string;
                usdNumerator: string;
                usdDenominator: string;
            }[];
            /** @enum {string} */
            mode: "sandbox";
        };
        /** Merchant */
        Merchant: {
            id: string;
            name: string;
            /** @enum {string} */
            mode: "sandbox";
            enabled: boolean;
            max_source_minor: string;
        };
        /** DeliveryList */
        DeliveryList: {
            data: {
                id: string;
                endpoint_id: string;
                event_id: string;
                /** @enum {string} */
                state: "pending" | "delivered" | "failed";
                attempts: number;
                status_code: number | null;
                last_error: string | null;
                next_attempt_at: string;
            }[];
        };
        /** Replay */
        Replay: {
            event_id: string;
            queued: number;
        };
        /** KeyCreated */
        KeyCreated: {
            id: string;
            name: string;
            prefix: string;
            scopes: string[];
            created_at: string;
            revoked_at: string | null;
            secret: string;
        };
        /** Overview */
        Overview: {
            volume_minor_usd: string;
            available_minor_usd: string;
            reserved_minor_usd: string;
            completed: number;
            total: number;
            open_reconciliation: number;
            chart: {
                date: string;
                minor_usd: string;
            }[];
            days: number;
        };
        /** RequestLogList */
        RequestLogList: {
            data: {
                request_id: string;
                method: string;
                path: string;
                status_code: number;
                duration_ms: number;
                created_at: string;
            }[];
        };
        /** ReconciliationList */
        ReconciliationList: {
            data: {
                id: string;
                intent_id: string;
                reason: string;
                /** @enum {string} */
                state: "open" | "resolved";
                created_at: string;
                resolved_at: string | null;
                reference: string;
            }[];
        };
        /** OperationDetail */
        OperationDetail: {
            intent: {
                id: string;
                /** @enum {string} */
                object: "intent";
                /** @enum {string} */
                provider: "kora-sandbox" | "paystack-test" | "stellar-testnet";
                /** @enum {string} */
                type: "transfer" | "asset_purchase" | "asset_redemption";
                /** @enum {string} */
                state: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
                /** @enum {string} */
                compliance_state: "sandbox_allowed" | "held";
                quote_id: string;
                source: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                destination: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                    instrument_id: string;
                };
                fee: {
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    amount_minor: string;
                };
                customer_id: string;
                reference: string;
                route: {
                    name: string;
                    rail: string;
                    asset: string;
                }[];
                created_at: string;
                updated_at: string;
                /** @enum {string} */
                mode: "sandbox";
                history?: {
                    state: string;
                    detail: string;
                    created_at: string;
                }[];
            };
            hold: {
                id: string;
                state: string;
                amount: string;
                /** @enum {string} */
                asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                reference: string;
            };
            instructions: {
                id: string;
                provider_ref: string;
                state: string;
                created_at: string;
            }[];
            attempts: {
                id: string;
                instruction_id: string;
                state: string;
                error_code: string | null;
                started_at: string;
                completed_at: string | null;
            }[];
            receipts: {
                id: string;
                instruction_id: string;
                provider_ref: string;
                payload: {
                    [key: string]: unknown;
                };
                created_at: string;
            }[];
            stellar_transactions: {
                instruction_id: string;
                transaction_hash: string;
                sequence: string;
                source_address: string;
                expires_at: string;
            }[];
            rail_receipts: {
                id: string;
                kind: string;
                provider_reference: string;
                provider_id: string | null;
                payload: {
                    [key: string]: unknown;
                };
                journal_id: string | null;
                created_at: string;
            }[];
            journals: {
                id: string;
                reference: string;
                description: string;
                created_at: string;
                entries: {
                    account_id: string;
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD" | "XLM";
                    /** @enum {string} */
                    side: "debit" | "credit";
                    amount: string;
                }[];
            }[];
        };
        /** Recovery */
        Recovery: {
            intent_id: string;
            queued: boolean;
        };
        /** DisabledEndpoint */
        DisabledEndpoint: {
            id: string;
            url: string;
            active: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getMerchant: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Merchant"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listAssets: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listBalances: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BalanceList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listCustomers: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createCustomer: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Customer"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getCustomer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Customer"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listInstruments: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InstrumentList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createInstrument: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    type: "bank_account" | "mobile_money" | "stellar_account";
                    /** @enum {string} */
                    asset: "NGN" | "KES" | "GHS" | "USDC";
                    label: string;
                    sandbox_identifier: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Instrument"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createQuote: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    source_asset: "NGN" | "KES" | "GHS" | "USDC";
                    /** @enum {string} */
                    destination_asset: "NGN" | "KES" | "GHS" | "USDC";
                    amount_minor: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Quote"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getQuote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Quote"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listIntents: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
                state?: "processing" | "unknown" | "succeeded" | "failed" | "canceled" | "returned";
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IntentList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createIntent: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    quote_id: string;
                    customer_id: string;
                    destination_instrument_id: string;
                    /**
                     * @default transfer
                     * @enum {string}
                     */
                    type?: "transfer" | "asset_purchase" | "asset_redemption";
                    reference: string;
                    /**
                     * @default success
                     * @enum {string}
                     */
                    scenario?: "success" | "timeout" | "insufficient_float";
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getIntent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    cancelIntent: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listEvents: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listWebhookEndpoints: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EndpointList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createWebhookEndpoint: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    url: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookEndpoint"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    disableWebhookEndpoint: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisabledEndpoint"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listWebhookDeliveries: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeliveryList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    replayEvent: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Replay"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getNetworkRouting: {
        parameters: {
            query: {
                amount_minor: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkRouting"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    recordNetworkHealth: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    participant_id: string;
                    /** @enum {string} */
                    status: "healthy" | "degraded" | "unavailable";
                    reason: string;
                    /** @default 300 */
                    valid_for_seconds?: number;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkHealthObservation"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getNetwork: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkRegistry"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listNetworkPlans: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkPlanList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getNetworkPlan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkPlan"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createNetworkQuote: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    corridor_id: string;
                    amount_minor: string;
                    /**
                     * @default success
                     * @enum {string}
                     */
                    scenario?: "success" | "timeout" | "insufficient_float";
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NetworkQuote"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createNetworkIntent: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    plan_id: string;
                    customer_id: string;
                    destination_instrument_id: string;
                    reference: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getControls: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlStatus"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listControlEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlEvidenceList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createControlEvidence: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    customer_id?: string;
                    /** @enum {string} */
                    kind: "kyb" | "kyc" | "screening" | "custody" | "security" | "legal" | "partner";
                    /** @enum {string} */
                    outcome: "checked" | "review" | "rejected";
                    reference: string;
                    reason: string;
                    /** Format: date-time */
                    expires_at: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlEvidence"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listControlApprovals: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlApprovalList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createControlApproval: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    action: "start_staging" | "resume" | "change_caps";
                    policy: {
                        caps: {
                            /** @enum {string} */
                            asset: "NGN" | "KES" | "GHS" | "USDC" | "KUSD";
                            per_transaction_minor: string;
                            per_day_minor: string;
                        }[];
                    };
                    reason: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlApproval"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listDailyReports: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlReportList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createDailyReport: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    day: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlReport"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listControlAudit: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlAuditList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    reviewControlApproval: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    decision: "approve" | "reject";
                    reason: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlApproval"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    pausePayments: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    reason: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ControlPause"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getRailStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RailStatus"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listBanks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BankList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    resolveBank: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    account_number: string;
                    bank_code: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BankResolution"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listBankAccounts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BankAccountList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createBankAccount: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    resolution_id: string;
                    label: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BankAccount"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createLocalPayout: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    customer_id: string;
                    destination_instrument_id: string;
                    amount_minor: string;
                    reference: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    verifyLocalPayout: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Recovery"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listCollections: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createCollection: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    customer_id: string;
                    amount_minor: string;
                    /** Format: email */
                    email: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Collection"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getCollection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Collection"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    verifyCollection: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CollectionRecovery"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    releaseCollection: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Collection"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listComplianceDecisions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ComplianceList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setComplianceDecision: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    decision: "allow" | "hold";
                    reason: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ComplianceDecision"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listStatements: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatementList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createStatement: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Statement"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getStatement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatementDetail"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getStellarStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarStatus"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getStellarChallenge: {
        parameters: {
            query: {
                address: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarChallenge"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listStellarAccounts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarAccountList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createStellarAccount: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    address: string;
                    signature: string;
                    label: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarAccount"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createStellarPurchase: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    customer_id: string;
                    destination_instrument_id: string;
                    amount_minor: string;
                    reference: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Intent"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listStellarDeposits: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarDepositList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    verifyStellarDeposit: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    customer_id: string;
                    instrument_id: string;
                    transaction_hash: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarDeposit"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listStellarRedemptions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarRedemptionList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    redeemStellarBalance: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    amount_minor: string;
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StellarRedemption"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getOverview: {
        parameters: {
            query?: {
                days?: "7" | "28";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Overview"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listApiKeys: {
        parameters: {
            query?: {
                limit?: string;
                after?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KeyList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createApiKey: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    scopes: ("payments:read" | "payments:write" | "customers:read" | "customers:write" | "webhooks:read" | "webhooks:write" | "keys:read" | "keys:write" | "operations:read" | "operations:write")[];
                };
            };
        };
        responses: {
            /** @description Default Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KeyCreated"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeApiKey: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiKey"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listRequestLogs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RequestLogList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listReconciliation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReconciliationList"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getOperationDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Default Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationDetail"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    recoverIntent: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Default Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Recovery"];
                };
            };
            /** @description Default Response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
