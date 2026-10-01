const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

function base64Url(input: Uint8Array | string) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function oauthRefreshAccessToken() {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw new Error(
      `Falha OAuth Google (refresh token): ${await response.text()}`,
    );
  const payload = await response.json();
  if (!payload.access_token)
    throw new Error("Google OAuth nao retornou access_token.");
  return payload.access_token as string;
}

async function serviceAccountAccessToken() {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!email || !privateKey)
    throw new Error("Credenciais Google Drive nao configuradas.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Falha OAuth Google (service account): ${await response.text()}`,
    );
  return (await response.json()).access_token as string;
}

async function accessToken() {
  const oauthToken = await oauthRefreshAccessToken();
  if (oauthToken) return oauthToken;
  return await serviceAccountAccessToken();
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(url, {
    signal: AbortSignal.timeout(30000),
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

export async function uploadDriveFile(file: File, folderId: string) {
  const token = await accessToken();
  const boundary = `rkc_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: file.name, parents: [folderId] });
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([
    new TextEncoder().encode(prefix),
    new Uint8Array(await file.arrayBuffer()),
    new TextEncoder().encode(suffix),
  ]);
  const response = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,parents`,
    {
      method: "POST",
      signal: AbortSignal.timeout(120000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok)
    throw new Error(`Falha no upload ao Drive: ${await response.text()}`);
  return response.json();
}

export async function renameDriveFile(fileId: string, name: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,parents`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok)
    throw new Error(`Falha ao renomear no Drive: ${await response.text()}`);
  return response.json();
}

export async function moveDriveFile(
  fileId: string,
  targetFolderId: string,
  currentFolderId?: string | null,
) {
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    addParents: targetFolderId,
    fields: "id,name,mimeType,size,webViewLink,parents",
  });
  if (currentFolderId) params.set("removeParents", currentFolderId);
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`,
    { method: "PATCH" },
  );
  if (!response.ok)
    throw new Error(`Falha ao mover no Drive: ${await response.text()}`);
  return response.json();
}

export async function trashDriveFile(fileId: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,trashed`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Falha ao mover arquivo para lixeira: ${await response.text()}`,
    );
  return response.json();
}

export async function downloadDriveFile(fileId: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
  );
  if (!response.ok)
    throw new Error(`Falha ao ler arquivo do Drive: ${await response.text()}`);
  return response;
}

export async function driveHealth(folderId: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=id,name,mimeType`,
  );
  if (!response.ok)
    throw new Error(`Drive indisponivel: ${await response.text()}`);
  return response.json();
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findDriveFolder(parentId: string, name: string) {
  const q = [
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ].join(" and ");
  const params = new URLSearchParams({
    q,
    spaces: "drive",
    pageSize: "100",
    fields: "files(id,name,parents),nextPageToken",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await driveFetch(`${DRIVE_API}/files?${params}`);
  if (!response.ok)
    throw new Error(
      `Falha ao localizar pasta no Drive: ${await response.text()}`,
    );
  const payload = await response.json();
  if (payload.nextPageToken || payload.files?.length > 1)
    throw new Error(
      `Mais de uma pasta chamada ${name}. Confirme o destino antes de enviar.`,
    );
  return payload.files?.[0] || null;
}

export async function createDriveFolder(name: string, parentId: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,parents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Falha ao criar pasta no Drive: ${await response.text()}`);
  return response.json();
}

export async function ensureDriveFolder(parentId: string, name: string) {
  const existing = await findDriveFolder(parentId, name);
  return existing || (await createDriveFolder(name, parentId));
}

export async function ensureDrivePath(
  rootFolderId: string,
  segments: string[],
) {
  let parentId = rootFolderId;
  const folders = [];
  for (const raw of segments) {
    const name = raw
      .trim()
      .replace(/[\\/]+/g, "-")
      .slice(0, 120);
    if (!name) continue;
    const folder = await ensureDriveFolder(parentId, name);
    folders.push(folder);
    parentId = folder.id;
  }
  return { folderId: parentId, folders };
}

export async function getDriveFolder(id: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,driveId,parents,trashed,capabilities(canAddChildren),owners(emailAddress,displayName),permissions(type,role)`,
  );
  if (!response.ok)
    throw new Error("Não foi possível confirmar a pasta no Drive RKC.");
  const folder = await response.json();
  if (
    folder.trashed ||
    folder.mimeType !== "application/vnd.google-apps.folder"
  )
    throw new Error("Destino indisponível ou não é uma pasta.");
  if (
    folder.permissions?.some((p: { type: string }) =>
      ["anyone", "domain"].includes(p.type),
    )
  )
    throw new Error(
      "A pasta permite acesso aberto. Configure acesso privado antes de enviar materiais.",
    );
  return folder;
}
export async function resolveAcademyFolder(
  rootId: string,
  allowCreate = false,
) {
  // Use the already-configured RKC integration; never fall back to a personal Drive.
  const root = await getDriveFolder(rootId);
  if (root.name !== "RKC - SISTEMA DO SITE")
    throw new Error(
      "A raiz configurada precisa ser RKC - SISTEMA DO SITE da RKC.",
    );
  let drive: { id?: string; name: string };
  if (root.driveId) {
    const driveResponse = await driveFetch(
      `${DRIVE_API}/drives/${encodeURIComponent(root.driveId)}?fields=id,name`,
    );
    if (!driveResponse.ok)
      throw new Error(
        "Não foi possível confirmar o Drive compartilhado da RKC.",
      );
    drive = await driveResponse.json();
    if (!/RKC|Kalunga/i.test(drive.name))
      throw new Error(
        "O Drive configurado não foi identificado como pertencente à RKC.",
      );
  } else {
    // A folder shared from RKC's own account is also supported, never from Play Moments.
    // The owner assertion is configuration on the existing integration, not a second OAuth connection.
    const rkcOwner = Deno.env
      .get("GOOGLE_DRIVE_RKC_OWNER_EMAIL")
      ?.trim()
      .toLowerCase();
    if (
      !rkcOwner ||
      !root.owners?.some(
        (owner: { emailAddress: string }) =>
          owner.emailAddress?.toLowerCase() === rkcOwner,
      )
    )
      throw new Error(
        "Confirme o proprietário RKC da pasta compartilhada em GOOGLE_DRIVE_RKC_OWNER_EMAIL. Drive pessoal da Play Moments não é aceito.",
      );
    drive = { name: "Pasta compartilhada da conta RKC" };
  }
  const candidates = (
    await Promise.all([
      findDriveFolder(root.id, "Academia"),
      findDriveFolder(root.id, "09_ACADEMIA"),
    ])
  ).filter(Boolean);
  if (candidates.length > 1)
    throw new Error(
      "Academia e 09_ACADEMIA existem: confirme qual pasta deve ser usada.",
    );
  const reused = candidates.length === 1;
  if (!reused && !allowCreate)
    throw new Error(
      "Pasta Academia ou 09_ACADEMIA não encontrada. A criação de 09_ACADEMIA será confirmada pelo serviço autenticado.",
    );
  // Creation is explicitly authorized by RKC; caller holds the global root lease.
  const destination =
    candidates[0] || (await createDriveFolder("09_ACADEMIA", root.id));
  const academy = await getDriveFolder(destination.id);
  if (
    academy.driveId !== root.driveId ||
    !academy.parents?.includes(root.id) ||
    !academy.capabilities?.canAddChildren
  )
    throw new Error(
      "Pasta Academia sem acesso de envio ou fora da raiz compartilhada RKC.",
    );
  return {
    id: academy.id,
    name: academy.name,
    rootId: root.id,
    driveId: root.driveId,
    driveName: drive.name,
    reused,
  };
}
export async function assertPrivateDriveFile(id: string) {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,permissions(type,role)`,
  );
  if (!response.ok)
    throw new Error("Não foi possível verificar a privacidade do arquivo.");
  const file = await response.json();
  if (
    file.permissions?.some((p: { type: string }) =>
      ["anyone", "domain"].includes(p.type),
    )
  )
    throw new Error(
      "O arquivo herdou acesso aberto no Drive. Envio não confirmado.",
    );
}
