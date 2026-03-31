import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import ErrorBanner from "@/components/ErrorBanner";
import { useTtgStore } from "@/store/ttgStore";
import { Eye, EyeOff } from "lucide-react";

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(values: string[]): string {
  return (values ?? []).join(", ");
}

export default function Settings() {
  const { config, loading, error, clearError, loadConfig, saveConfig, clearHistory, debugUi, setDebugUi } = useTtgStore();

  const defaultListUrl =
    "https://totheglory.im/browse.php?c=M&search_field=category:%22%E5%BD%B1%E8%A7%862160p%22";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [securityQuestionId, setSecurityQuestionId] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [showSecurityAnswer, setShowSecurityAnswer] = useState(false);
  const [cookieHeader, setCookieHeader] = useState("");
  const [listUrlsText, setListUrlsText] = useState(defaultListUrl);
  const [crawlInterval, setCrawlInterval] = useState(15);
  const [maxPages, setMaxPages] = useState(2);
  const [requestDelayMs, setRequestDelayMs] = useState(800);
  const [resultsPageSize, setResultsPageSize] = useState(100);

  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [categories, setCategories] = useState("");
  const defaultImdbSeedConditions = useMemo(
    () => [
      { minImdbScore: "6", minSeeders: "10" },
      { minImdbScore: "5", minSeeders: "30" },
      { minImdbScore: "7", minSeeders: "1" },
    ],
    [],
  );
  const [imdbSeedConditions, setImdbSeedConditions] = useState(defaultImdbSeedConditions);
  const [minSizeMb, setMinSizeMb] = useState("");
  const [maxSizeMb, setMaxSizeMb] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("ttg_username") ?? "";
    const storedPassword = sessionStorage.getItem("ttg_password") ?? "";
    const storedSecurityQuestionId = sessionStorage.getItem("ttg_security_question_id") ?? "";
    const storedSecurityAnswer = sessionStorage.getItem("ttg_security_answer") ?? "";
    const storedCookieHeader = sessionStorage.getItem("ttg_cookie_header") ?? "";
    const storedListUrlsText = sessionStorage.getItem("ttg_list_urls") ?? "";

    if (!username && storedUsername) setUsername(storedUsername);
    if (!password && storedPassword) setPassword(storedPassword);
    if (!securityQuestionId && storedSecurityQuestionId) setSecurityQuestionId(storedSecurityQuestionId);
    if (!securityAnswer && storedSecurityAnswer) setSecurityAnswer(storedSecurityAnswer);
    if (!cookieHeader && storedCookieHeader) setCookieHeader(storedCookieHeader);
    if (storedListUrlsText && listUrlsText === defaultListUrl) setListUrlsText(storedListUrlsText);
  }, []);

  useEffect(() => {
    if (!config) return;
    if (!username) setUsername(config.credentials.username ?? "");
    if (!cookieHeader) setCookieHeader(config.credentials.cookieHeader ?? "");
    setListUrlsText((config.listUrls ?? []).join("\n"));
    setCrawlInterval(config.schedule.crawlIntervalMinutes);
    setMaxPages(config.schedule.maxPages);
    setRequestDelayMs(config.schedule.requestDelayMs);
    setResultsPageSize(config.schedule.resultsPageSize ?? 100);

    setIncludeKeywords(joinList(config.filters.includeKeywords));
    setExcludeKeywords(joinList(config.filters.excludeKeywords));
    setCategories(joinList(config.filters.categories));
    if (config.filters.imdbSeedConditions?.length) {
      setImdbSeedConditions(
        config.filters.imdbSeedConditions.map((c) => ({
          minImdbScore: String(c.minImdbScore),
          minSeeders: String(c.minSeeders),
        })),
      );
    } else if (typeof config.filters.minImdbScore === "number" || typeof config.filters.minSeeders === "number") {
      setImdbSeedConditions([
        {
          minImdbScore:
            typeof config.filters.minImdbScore === "number" ? String(config.filters.minImdbScore) : "0",
          minSeeders:
            typeof config.filters.minSeeders === "number" ? String(config.filters.minSeeders) : "0",
        },
        ...defaultImdbSeedConditions,
      ]);
    } else {
      setImdbSeedConditions(defaultImdbSeedConditions);
    }
    setMinSizeMb(config.filters.minSizeMb ? String(config.filters.minSizeMb) : "");
    setMaxSizeMb(config.filters.maxSizeMb ? String(config.filters.maxSizeMb) : "");
    setDateFrom(config.filters.dateFrom ?? "");
    setDateTo(config.filters.dateTo ?? "");
  }, [config]);

  const parsedListUrls = useMemo(() => splitList(listUrlsText), [listUrlsText]);

  const handleSave = async (): Promise<void> => {
    clearError();
    try {
      const listUrls = parsedListUrls.length ? parsedListUrls : [defaultListUrl];
      await saveConfig({
        username: username || null,
        password: password || null,
        securityQuestionId: securityQuestionId || null,
        securityAnswer: securityAnswer || null,
        cookieHeader: cookieHeader || null,
        listUrls,
        crawlInterval,
        maxPages,
        requestDelayMs,
        resultsPageSize,
        filters: {
          includeKeywords: splitList(includeKeywords),
          excludeKeywords: splitList(excludeKeywords),
          categories: splitList(categories),
          imdbSeedConditions: imdbSeedConditions
            .map((c) => ({
              minImdbScore: Number(c.minImdbScore),
              minSeeders: Number(c.minSeeders),
            }))
            .filter((c) => Number.isFinite(c.minImdbScore) && Number.isFinite(c.minSeeders)),
          minImdbScore: null,
          minSeeders: null,
          minSizeMb: minSizeMb ? Number(minSizeMb) : null,
          maxSizeMb: maxSizeMb ? Number(maxSizeMb) : null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
      });

      sessionStorage.setItem("ttg_username", username);
      sessionStorage.setItem("ttg_password", password);
      sessionStorage.setItem("ttg_security_question_id", securityQuestionId);
      sessionStorage.setItem("ttg_security_answer", securityAnswer);
      sessionStorage.setItem("ttg_cookie_header", cookieHeader);
      sessionStorage.setItem("ttg_list_urls", listUrlsText);
    } catch {
      // error handled by store
    }
  };

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onClose={clearError} /> : null}

      <Card>
        <CardHeader
          title="Credentials"
          subtitle="Stored encrypted at rest on the server"
        />
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Username</div>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="TTG username" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Password</div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Security Question ID (optional)</div>
            <Input value={securityQuestionId} onChange={(e) => setSecurityQuestionId(e.target.value)} placeholder="0-7" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Security Answer (optional)</div>
            <div className="relative">
              <Input
                type={showSecurityAnswer ? "text" : "password"}
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Leave blank to keep current"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                onClick={() => setShowSecurityAnswer((v) => !v)}
                aria-label={showSecurityAnswer ? "Hide security answer" : "Show security answer"}
              >
                {showSecurityAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-zinc-400 mb-1">Cookie Header (optional)</div>
            <Textarea
              value={cookieHeader}
              onChange={(e) => setCookieHeader(e.target.value)}
              placeholder="Paste the full Cookie header from a logged-in browser session"
            />
            <div className="text-xs text-zinc-500 mt-1">If set, cookies are tried before form login</div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Crawler" subtitle="List URLs and scan pacing" />
          <CardBody className="space-y-4">
            <div>
              <div className="text-xs text-zinc-400 mb-1">List URLs (one per line)</div>
              <Textarea value={listUrlsText} onChange={(e) => setListUrlsText(e.target.value)} />
              <div className="text-xs text-zinc-500 mt-1">
                For multi-page scans, you can add a placeholder like {"{{page}}"} or {"{page}"}.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Interval (minutes)</div>
                <Input
                  type="number"
                  value={crawlInterval}
                  onChange={(e) => setCrawlInterval(Number(e.target.value || 0))}
                  min={0}
                />
                <div className="text-xs text-zinc-500 mt-1">0 disables scheduler</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Max pages</div>
                <Input type="number" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value || 1))} min={1} />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Delay (ms)</div>
                <Input
                  type="number"
                  value={requestDelayMs}
                  onChange={(e) => setRequestDelayMs(Number(e.target.value || 0))}
                  min={0}
                />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Results / page</div>
                <Input
                  type="number"
                  value={resultsPageSize}
                  onChange={(e) => setResultsPageSize(Number(e.target.value || 100))}
                  min={10}
                  max={500}
                />
                <div className="text-xs text-zinc-500 mt-1">Default 100</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Filters" subtitle="Applied to new items only" />
          <CardBody className="space-y-4">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Include keywords (comma/newline separated)</div>
              <Textarea value={includeKeywords} onChange={(e) => setIncludeKeywords(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Exclude keywords</div>
              <Textarea value={excludeKeywords} onChange={(e) => setExcludeKeywords(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Categories (exact match)</div>
              <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="e.g. Movies, TV" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-400 mb-1">IMDB/Seed conditions (OR)</div>
                  <div className="text-xs text-zinc-500">Keeps items with missing IMDB score</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setImdbSeedConditions((prev) => [...prev, { minImdbScore: "6", minSeeders: "10" }])
                  }
                >
                  Add Condition
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {imdbSeedConditions.map((c, idx) => (
                  <div key={idx} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-4">
                        <div className="text-xs text-zinc-500 mb-1">IMDB ≥</div>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          value={c.minImdbScore}
                          onChange={(e) =>
                            setImdbSeedConditions((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, minImdbScore: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      <div className="hidden sm:col-span-1 sm:block text-center text-xs text-zinc-500">AND</div>
                      <div className="sm:col-span-4">
                        <div className="text-xs text-zinc-500 mb-1">Seed ≥</div>
                        <Input
                          type="number"
                          min={0}
                          max={999}
                          step={1}
                          value={c.minSeeders}
                          onChange={(e) =>
                            setImdbSeedConditions((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, minSeeders: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setImdbSeedConditions((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={imdbSeedConditions.length <= 1}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Min size (MB)</div>
                <Input value={minSizeMb} onChange={(e) => setMinSizeMb(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Max size (MB)</div>
                <Input value={maxSizeMb} onChange={(e) => setMaxSizeMb(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Date from (ISO)</div>
                <Input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Date to (ISO)</div>
                <Input value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Save"
          subtitle="Persists encrypted config + checkpoint on the backend"
          right={
            <Button
              onClick={() => void handleSave()}
              disabled={loading.save}
            >
              Save Settings
            </Button>
          }
        />
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">Tip: keep `Interval` at 0 if you only want manual scans.</div>
            <Button variant="secondary" size="sm" onClick={() => void clearHistory()}>
              Clear Tracking Log
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div>
              <div className="text-xs text-zinc-400">Debug UI</div>
              <div className="text-xs text-zinc-500">Shows extra debug columns on Results</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDebugUi(!debugUi)}>
              {debugUi ? "On" : "Off"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
