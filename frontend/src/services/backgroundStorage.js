const DB_NAME = "guitar-livre-preferences";
const DB_VERSION = 1;
const STORE_NAME = "assets";
const SETTINGS_KEY = "guitar-livre-background-settings";

const DEFAULT_SETTINGS = {
  backgroundMode: "song-video", // song-video | image | video | none
  backgroundImageId: null,
  backgroundVideoId: null,
  highwayImageId: null,
  highwayOpacity: 0.34,
  highwayDarkness: 0.38,
};

/*
 * ============================================================
 * INDEXEDDB
 * ============================================================
 *
 * Usamos IndexedDB para armazenar os arquivos escolhidos pelo
 * usuário sem jogar blobs grandes dentro do localStorage.
 */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "IndexedDB não está disponível neste navegador."
        )
      );
      return;
    }

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          STORE_NAME
        )
      ) {
        db.createObjectStore(
          STORE_NAME
        );
      }
    };

    request.onsuccess = () =>
      resolve(
        request.result
      );

    request.onerror = () =>
      reject(
        request.error ||
          new Error(
            "Falha ao abrir o armazenamento local."
          )
      );
  });
}


/*
 * ============================================================
 * ID DOS ARQUIVOS
 * ============================================================
 */

function makeAssetId(type) {
  if (
    typeof crypto !==
      "undefined" &&
    crypto.randomUUID
  ) {
    return `guitar-livre-${type}-${crypto.randomUUID()}`;
  }

  return (
    `guitar-livre-${type}-` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2)}`
  );
}


/*
 * ============================================================
 * CONFIGURAÇÕES
 * ============================================================
 */

export function getBackgroundSettings() {
  try {
    const raw =
      localStorage.getItem(
        SETTINGS_KEY
      );

    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
      };
    }

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
    };
  }
}


/*
 * Salva apenas os campos enviados e preserva
 * os demais.
 */

export function saveBackgroundSettings(
  partial
) {
  const next = {
    ...getBackgroundSettings(),
    ...partial,
  };

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(next)
  );

  /*
   * Permite que Game.jsx ou outras telas
   * saibam que a configuração foi alterada
   * sem precisar recarregar a página.
   */

  window.dispatchEvent(
    new CustomEvent(
      "guitarLivreBackgroundSettingsChanged",
      {
        detail: next,
      }
    )
  );

  return next;
}


/*
 * ============================================================
 * SALVAR ASSETS
 * ============================================================
 */

export async function saveBackgroundAsset(
  type,
  blob
) {
  const db =
    await openDatabase();

  const id =
    makeAssetId(type);

  await new Promise(
    (
      resolve,
      reject
    ) => {
      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_NAME
        );

      store.put(
        {
          id,
          type,
          blob,
          createdAt:
            Date.now(),
        },
        id
      );

      transaction.oncomplete =
        resolve;

      transaction.onerror =
        () =>
          reject(
            transaction.error ||
              new Error(
                "Falha ao salvar arquivo local."
              )
          );
    }
  );

  db.close();

  return id;
}


/*
 * ============================================================
 * LER ASSET
 * ============================================================
 */

export async function getBackgroundAsset(
  id
) {
  if (!id) {
    return null;
  }

  const db =
    await openDatabase();

  const record =
    await new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            STORE_NAME,
            "readonly"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.get(id);

        request.onsuccess =
          () =>
            resolve(
              request.result ||
                null
            );

        request.onerror =
          () =>
            reject(
              request.error ||
                new Error(
                  "Falha ao ler arquivo local."
                )
            );
      }
    );

  db.close();

  return (
    record?.blob ||
    null
  );
}


/*
 * ============================================================
 * DELETAR ASSET
 * ============================================================
 */

export async function deleteBackgroundAsset(
  id
) {
  if (!id) {
    return;
  }

  const db =
    await openDatabase();

  await new Promise(
    (
      resolve,
      reject
    ) => {
      const transaction =
        db.transaction(
          STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_NAME
        );

      store.delete(id);

      transaction.oncomplete =
        resolve;

      transaction.onerror =
        () =>
          reject(
            transaction.error ||
              new Error(
                "Falha ao remover arquivo local."
              )
          );
    }
  );

  db.close();
}


/*
 * ============================================================
 * SUBSTITUIR ASSET
 * ============================================================
 *
 * Salva o novo primeiro e só depois tenta
 * remover o antigo.
 *
 * Isso evita deixar o usuário sem arquivo
 * se ocorrer uma falha durante a gravação.
 */

export async function replaceBackgroundAsset(
  type,
  oldId,
  blob
) {
  const newId =
    await saveBackgroundAsset(
      type,
      blob
    );

  if (oldId) {
    try {
      await deleteBackgroundAsset(
        oldId
      );
    } catch {
      /*
       * A troca continua funcionando
       * mesmo que a limpeza do asset antigo
       * falhe.
       */
    }
  }

  return newId;
}


/*
 * ============================================================
 * LIMPAR ASSET + CONFIGURAÇÃO
 * ============================================================
 */

export async function clearBackgroundAsset(
  type,
  id
) {
  if (id) {
    try {
      await deleteBackgroundAsset(
        id
      );
    } catch {
      /*
       * Limpeza best-effort.
       */
    }
  }

  const patch = {};

  if (
    type ===
    "background-image"
  ) {
    patch.backgroundImageId =
      null;
  }

  if (
    type ===
    "background-video"
  ) {
    patch.backgroundVideoId =
      null;
  }

  if (
    type ===
    "highway-image"
  ) {
    patch.highwayImageId =
      null;
  }

  return saveBackgroundSettings(
    patch
  );
}


/*
 * ============================================================
 * EXPORT DEFAULTS
 * ============================================================
 */

export {
  DEFAULT_SETTINGS,
};