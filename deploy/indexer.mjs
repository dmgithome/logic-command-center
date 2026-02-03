import fs from "node:fs/promises";
import path from "node:path";

const manifestsRoot = process.env.MANIFESTS_ROOT ?? "/home/dm/apps/logic-command-center/manifests";

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  await fs.rename(tmp, filePath);
}

function isShaLike(name) {
  // Git SHA can be 7..40 hex, we keep it len>=7.
  return /^[0-9a-f]{7,40}$/i.test(name);
}

async function main() {
  await fs.mkdir(manifestsRoot, { recursive: true });

  const dirents = await fs.readdir(manifestsRoot, { withFileTypes: true });
  const projectDirs = dirents.filter(d => d.isDirectory()).map(d => d.name).sort();

  const projects = [];

  for (const projectId of projectDirs) {
    const projectPath = path.join(manifestsRoot, projectId);
    const files = await fs.readdir(projectPath);

    // Collect commit versions from "<sha>.json"
    const versions = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const base = f.slice(0, -".json".length);
      if (base === "latest" || base === "index") continue;
      if (!isShaLike(base)) continue;
      versions.push(base);
    }

    // Best-effort read project name from latest.json
    let name;
    const latestPath = path.join(projectPath, "latest.json");
    if (await fileExists(latestPath)) {
      try {
        const latest = JSON.parse(await fs.readFile(latestPath, "utf-8"));
        name = latest?.project?.name;
      } catch {
        // ignore
      }
    }

    projects.push(name ? { id: projectId, name } : { id: projectId });

    // Best-effort attach generated_at by reading each version file
    const entries = [];
    for (const commit of versions) {
      const p = path.join(projectPath, `${commit}.json`);
      try {
        const raw = JSON.parse(await fs.readFile(p, "utf-8"));
        const generatedAt = raw?.generated_at ?? raw?.project?.updated_at;
        entries.push(generatedAt ? { commit, generated_at: generatedAt } : { commit });
      } catch {
        entries.push({ commit });
      }
    }

    // Keep stable newest-first by generated_at, otherwise by commit name.
    entries.sort((a, b) => (b.generated_at ?? "").localeCompare(a.generated_at ?? "") || b.commit.localeCompare(a.commit));

    await writeJsonAtomic(path.join(projectPath, "index.json"), { project_id: projectId, versions: entries });
  }

  await writeJsonAtomic(path.join(manifestsRoot, "projects.json"), projects);
  console.log("indexed projects:", projects.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

