// Cliente para eventos com isp_id temporário diferente
import { externalSupabase } from "./external-client";

// ISP ID temporário para eventos (d-kiros) - será alterado para agy-telecom depois
export const EVENTOS_ISP_ID = "d-kiros";

// Re-exportar o cliente
export { externalSupabase };
