---
name: Asset Cloud Writer
description: useAssetWriter persiste investimentos na tabela assets espelhando usePlanWriter, com hidratação e cache local
type: feature
---
Investimentos da aba Patrimônio escrevem na tabela `assets` via `useAssetWriter` (createAsset/updateAsset/deleteAsset/deactivateAsset/listAssets). Mapeamento Investment ↔ assets: name → ticker_or_name, type → asset_type, currentBalance → current_amount/net_estimated/invested_amount, securityLevel → has_fgc/has_sovereign_guarantee, profileId → member_id (resolvido via cloudPrimaryMember/cloudPartnerMember). Hidratação ao logar mescla cloud com cache local sem duplicar (por id). useAppData/useCloudSync seguem em paralelo como rede de segurança até a Fase 2.D.
