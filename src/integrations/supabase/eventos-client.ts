// Cliente para eventos com isp_id - usando agy-telecom temporariamente
import { externalSupabase, ISP_ID } from "./external-client";

// ISP ID para eventos - temporariamente usando agy-telecom até d-kiros estar disponível
// TODO: Mudar para "d-kiros" quando os dados estiverem prontos
export const EVENTOS_ISP_ID = ISP_ID; // "agy-telecom"

// Re-exportar o cliente
export { externalSupabase };
