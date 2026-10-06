import { createClient } from "@supabase/supabase-js";
import { optimizeMateriaDriveForm } from "@/lib/materiaMediaOptimization";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const functionsClient = client.functions as any;
const invokeFunction = functionsClient.invoke.bind(functionsClient);

functionsClient.invoke = async (functionName: string, options?: any) => {
  if (
    functionName === "drive-files" &&
    options?.body instanceof FormData &&
    typeof File !== "undefined"
  ) {
    try {
      options = {
        ...options,
        body: await optimizeMateriaDriveForm(options.body),
      };
    } catch (error) {
      // Nunca impede a publicação: se a otimização local falhar, o backend
      // continua validando e recebendo o arquivo original.
      console.warn("[materia-media] falha na otimização local", error);
    }
  }

  return invokeFunction(functionName, options);
};

export const supabase = client;
