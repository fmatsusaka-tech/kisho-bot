/**
 * 和歌山気象データ取得システム
 *
 * 生データ：
 *   - 川辺
 *   - 湯浅
 *   - 海老名
 *
 * 再生成可能なシート：
 *   - データ分析
 *   - 管理
 *   - データチェック
 *
 * 追記保存するシート：
 *   - 取得ログ
 */

const WEATHER_CONFIG = Object.freeze({
  TIME_ZONE: 'Asia/Tokyo',
  HISTORICAL_START_DATE: '1976-01-01',
  UPDATE_LOOKBACK_DAYS: 3,
  REQUEST_INTERVAL_MS: 150,
  HISTORICAL_CHUNK_YEARS: 12,
  FETCH_BATCH_MONTHS: 12,

  STATIONS: Object.freeze({
    KAWABE: Object.freeze({
      name: '川辺',
      precNo: '65',
      blockNo: '1485',
      hasTemperature: true,
      hasRainfall: true,
      startDate: '1999-03-04',
      temperatureStartDate: '1999-03-04',
    }),
    YUASA: Object.freeze({
      name: '湯浅',
      precNo: '65',
      blockNo: '0978',
      hasTemperature: false,
      hasRainfall: true,
      startDate: '1976-01-01',
      temperatureStartDate: null,
    }),
    EBINA: Object.freeze({
      name: '海老名',
      precNo: '46',
      blockNo: '0388',
      hasTemperature: true,
      hasRainfall: true,
      startDate: '1976-01-01',
      temperatureStartDate: '1978-01-17',
    }),
  }),

  SHEETS: Object.freeze({
    KAWABE: '川辺',
    YUASA: '湯浅',
    EBINA: '海老名',
    ANALYSIS: 'データ分析',
    MANAGEMENT: '管理',
    LOG: '取得ログ',
    CHECK: 'データチェック',
  }),
});

const RAW_HEADERS = Object.freeze([
  '年月日',
  '平均気温(℃)',
  '最高気温(℃)',
  '最低気温(℃)',
  '降水量(mm)',
]);

const ANALYSIS_HEADERS = Object.freeze([
  '年月日',
  '降水量（湯浅）',
  '平均気温（川辺）',
  '最高気温（川辺）',
  '最低気温（川辺）',
  '日較差（川辺）',
  '15日平均気温（川辺）',
  '30日平均気温（川辺）',
  '15日積算降水量（湯浅）',
  '30日積算降水量（湯浅）',
  '降水量（川辺・比較用）',
  '降水量（海老名）',
  '平均気温（海老名）',
  '最高気温（海老名）',
  '最低気温（海老名）',
]);

const LOG_HEADERS = Object.freeze([
  '実行日時',
  '実行種別',
  '実行関数',
  '取得開始日',
  '取得終了日',
  '川辺取得件数',
  '湯浅取得件数',
  '川辺総件数',
  '湯浅総件数',
  '結果',
  'エラー内容',
  '海老名取得件数',
  '海老名総件数',
]);

const CHECK_HEADERS = Object.freeze([
  '検出日時',
  '重要度',
  '種別',
  '地点・シート',
  '対象日',
  '内容',
  '対応',
]);

/**
 * スプレッドシートを開いたときに専用メニューを追加する。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('気象データ管理')
    .addItem('最新データを更新', 'updateWeatherNow')
    .addItem('指定期間を再取得', 'refetchPeriodFromManagement')
    .addSeparator()
    .addItem('川辺の過去データを追加', 'backfillKawabeHistoricalData')
    .addItem('湯浅の過去データを追加', 'backfillYuasaHistoricalData')
    .addItem('海老名の過去データを追加', 'backfillEbinaHistoricalData')
    .addItem('過去データ追加を確定', 'finalizeHistoricalBackfill')
    .addSeparator()
    .addItem('欠測・重複を確認', 'runWeatherDataChecks')
    .addItem('分析シートを再作成', 'rebuildAnalysisSheet')
    .addItem('管理シートを更新', 'refreshManagementSheet')
    .addSeparator()
    .addItem('トリガーを再設定', 'installWeatherTriggers')
    .addItem('初回セットアップを実行', 'setupWeatherSystem')
    .addToUi();
}

/**
 * 初回セットアップ。
 * 各地点の観測開始日から前日までを取得し、生データ・分析・管理・チェックを作成する。
 */
function setupWeatherSystem() {
  executeWithLock_('初回セットアップ', 'setupWeatherSystem', true, function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.setSpreadsheetTimeZone(WEATHER_CONFIG.TIME_ZONE);
    ensureOperationalSheets_();

    const startDate = parseYmd_(WEATHER_CONFIG.HISTORICAL_START_DATE);
    const endDate = getYesterday_();
    validatePeriod_(startDate, endDate);

    const kawabeFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.KAWABE, parseYmd_(WEATHER_CONFIG.STATIONS.KAWABE.startDate), endDate);
    const yuasaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.YUASA, parseYmd_(WEATHER_CONFIG.STATIONS.YUASA.startDate), endDate);
    const ebinaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.EBINA, parseYmd_(WEATHER_CONFIG.STATIONS.EBINA.startDate), endDate);

    writeKawabeSheet_(kawabeFetched);
    writeYuasaSheet_(yuasaFetched);
    writeEbinaSheet_(ebinaFetched);
    writeAnalysisSheet_(kawabeFetched, yuasaFetched, ebinaFetched);

    installWeatherTriggers_(false);
    const checkResult = buildDataCheckSheet_();

    const result = makeOperationResult_({
      operationType: '初回',
      functionName: 'setupWeatherSystem',
      startDate: startDate,
      endDate: endDate,
      kawabeFetched: kawabeFetched.length,
      yuasaFetched: yuasaFetched.length,
      ebinaFetched: ebinaFetched.length,
      kawabeTotal: kawabeFetched.length,
      yuasaTotal: yuasaFetched.length,
      ebinaTotal: ebinaFetched.length,
      status: '成功',
      errorMessage: '',
      issueCount: checkResult.issueCount,
    });

    saveLastOperation_(result, true);
    appendLog_(result);
    writeManagementSheet_(result);

    SpreadsheetApp.getActiveSpreadsheet().toast(
      '初回セットアップが完了しました。',
      '和歌山気象データ',
      8
    );
  });
}

/**
 * 毎日1回の自動更新用関数。
 */
function scheduledWeatherUpdate() {
  executeWithLock_('自動更新', 'scheduledWeatherUpdate', false, function () {
    performIncrementalUpdate_('自動', 'scheduledWeatherUpdate', false);
  });
}

/**
 * メニューから実行する手動更新。
 */
function updateWeatherNow() {
  executeWithLock_('手動更新', 'updateWeatherNow', true, function () {
    performIncrementalUpdate_('手動', 'updateWeatherNow', true);
  });
}

/** 各地点で気象庁が公開している最古日まで、既存データより前を追加する。 */
function backfillKawabeHistoricalData() {
  backfillStationHistoricalData_('KAWABE');
}

function backfillYuasaHistoricalData() {
  backfillStationHistoricalData_('YUASA');
}

function backfillEbinaHistoricalData() {
  backfillStationHistoricalData_('EBINA');
}

function backfillStationHistoricalData_(stationKey) {
  const station = WEATHER_CONFIG.STATIONS[stationKey];
  if (!station) {
    throw new Error(`不明な地点キーです：${stationKey}`);
  }

  executeWithLock_('過去データ追加', `backfill${stationKey}HistoricalData`, false, function () {
    ensureOperationalSheets_();
    const existingKawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
    const existingYuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
    const existingEbina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;
    const existingByKey = { KAWABE: existingKawabe, YUASA: existingYuasa, EBINA: existingEbina };
    const existing = sortWeatherData_(existingByKey[stationKey]);
    const stationStartDate = parseYmd_(station.startDate);
    const earliestExisting = existing.length > 0 ? normalizeDateValue_(existing[0].date) : getYesterday_();
    const endDate = addDays_(earliestExisting, -1);

    if (endDate < stationStartDate) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `${station.name}はすでに最古日まで登録済みです。`,
        '和歌山気象データ',
        8
      );
      return;
    }

    const chunkYear = Math.max(
      stationStartDate.getFullYear(),
      endDate.getFullYear() - WEATHER_CONFIG.HISTORICAL_CHUNK_YEARS + 1
    );
    const chunkStart = new Date(chunkYear, 0, 1, 12, 0, 0);
    const startDate = chunkStart > stationStartDate ? chunkStart : stationStartDate;

    const fetched = fetchPeriodData_(station, startDate, endDate);
    const merged = mergeWeatherData_(existing, fetched);
    const mergedKawabe = stationKey === 'KAWABE' ? merged : existingKawabe;
    const mergedYuasa = stationKey === 'YUASA' ? merged : existingYuasa;
    const mergedEbina = stationKey === 'EBINA' ? merged : existingEbina;
    if (stationKey === 'KAWABE') writeKawabeSheet_(mergedKawabe);
    if (stationKey === 'YUASA') writeYuasaSheet_(mergedYuasa);
    if (stationKey === 'EBINA') writeEbinaSheet_(mergedEbina);

    const result = makeOperationResult_({
      operationType: '過去データ追加',
      functionName: `backfill${stationKey}HistoricalData`,
      startDate: startDate,
      endDate: endDate,
      kawabeFetched: stationKey === 'KAWABE' ? fetched.length : 0,
      yuasaFetched: stationKey === 'YUASA' ? fetched.length : 0,
      ebinaFetched: stationKey === 'EBINA' ? fetched.length : 0,
      kawabeTotal: mergedKawabe.length,
      yuasaTotal: mergedYuasa.length,
      ebinaTotal: mergedEbina.length,
      status: '成功',
      errorMessage: '',
      issueCount: countCurrentIssues_(),
    });

    saveLastOperation_(result, true);
    appendLog_(result);
    writeManagementSheet_(result);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `${station.name}の${formatYmd_(startDate)}～${formatYmd_(endDate)}を追加しました。`,
      '和歌山気象データ',
      8
    );
  });
}

/** 3地点の追加完了後に、公開分析・検査・管理を一度だけ再構築する。 */
function finalizeHistoricalBackfill() {
  executeWithLock_('過去データ確定', 'finalizeHistoricalBackfill', false, function () {
    const kawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
    const yuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
    const ebina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;
    writeAnalysisSheet_(kawabe, yuasa, ebina);
    const checkResult = buildDataCheckSheet_();
    const result = makeOperationResult_({
      operationType: '過去データ確定',
      functionName: 'finalizeHistoricalBackfill',
      startDate: parseYmd_(WEATHER_CONFIG.HISTORICAL_START_DATE),
      endDate: getYesterday_(),
      kawabeFetched: 0,
      yuasaFetched: 0,
      ebinaFetched: 0,
      kawabeTotal: kawabe.length,
      yuasaTotal: yuasa.length,
      ebinaTotal: ebina.length,
      status: '成功',
      errorMessage: '',
      issueCount: checkResult.issueCount,
    });
    saveLastOperation_(result, true);
    appendLog_(result);
    writeManagementSheet_(result);
    SpreadsheetApp.getActiveSpreadsheet().toast('過去データの分析・検査を再構築しました。', '和歌山気象データ', 8);
  });
}

/**
 * 管理シートのB19・B20に入力された期間を再取得する。
 */
function refetchPeriodFromManagement() {
  executeWithLock_('指定期間再取得', 'refetchPeriodFromManagement', true, function () {
    ensureOperationalSheets_();
    const managementSheet = getOrCreateSheet_(WEATHER_CONFIG.SHEETS.MANAGEMENT);
    const startValue = managementSheet.getRange('B19').getValue();
    const endValue = managementSheet.getRange('B20').getValue();

    if (!startValue || !endValue) {
      throw new Error('管理シートのB19に開始日、B20に終了日を入力してください。');
    }

    const startDate = normalizeDateValue_(startValue);
    const endDate = normalizeDateValue_(endValue);
    validatePeriod_(startDate, endDate);

    const existingKawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
    const existingYuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
    const existingEbina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;

    const kawabeFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.KAWABE, startDate, endDate);
    const yuasaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.YUASA, startDate, endDate);
    const ebinaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.EBINA, startDate, endDate);

    const mergedKawabe = mergeWeatherData_(existingKawabe, kawabeFetched);
    const mergedYuasa = mergeWeatherData_(existingYuasa, yuasaFetched);
    const mergedEbina = mergeWeatherData_(existingEbina, ebinaFetched);

    writeAllWeatherSheets_(mergedKawabe, mergedYuasa, mergedEbina);
    const checkResult = buildDataCheckSheet_();

    const result = makeOperationResult_({
      operationType: '期間再取得',
      functionName: 'refetchPeriodFromManagement',
      startDate: startDate,
      endDate: endDate,
      kawabeFetched: kawabeFetched.length,
      yuasaFetched: yuasaFetched.length,
      ebinaFetched: ebinaFetched.length,
      kawabeTotal: mergedKawabe.length,
      yuasaTotal: mergedYuasa.length,
      ebinaTotal: mergedEbina.length,
      status: '成功',
      errorMessage: '',
      issueCount: checkResult.issueCount,
    });

    saveLastOperation_(result, true);
    appendLog_(result);
    writeManagementSheet_(result);

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `${formatYmd_(startDate)}～${formatYmd_(endDate)}を再取得しました。`,
      '和歌山気象データ',
      8
    );
  });
}

/**
 * 生データを変更せず、分析シートだけを再作成する。
 */
function rebuildAnalysisSheet() {
  executeWithLock_('分析シート再作成', 'rebuildAnalysisSheet', true, function () {
    ensureOperationalSheets_();
    const kawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
    const yuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
    const ebina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;
    writeAnalysisSheet_(kawabe, yuasa, ebina);
    const checkResult = buildDataCheckSheet_();

    const result = makeOperationResult_({
      operationType: '分析再作成',
      functionName: 'rebuildAnalysisSheet',
      startDate: null,
      endDate: null,
      kawabeFetched: 0,
      yuasaFetched: 0,
      ebinaFetched: 0,
      kawabeTotal: kawabe.length,
      yuasaTotal: yuasa.length,
      ebinaTotal: ebina.length,
      status: '成功',
      errorMessage: '',
      issueCount: checkResult.issueCount,
    });

    saveLastOperation_(result, false);
    appendLog_(result);
    writeManagementSheet_(result);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '分析シートを生データから再作成しました。',
      '和歌山気象データ',
      6
    );
  });
}

/**
 * 欠測・重複・湯浅気温列の混入などを確認する。
 */
function runWeatherDataChecks() {
  executeWithLock_('データチェック', 'runWeatherDataChecks', true, function () {
    ensureOperationalSheets_();
    const checkResult = buildDataCheckSheet_();
    const kawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
    const yuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
    const ebina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;

    const result = makeOperationResult_({
      operationType: 'データチェック',
      functionName: 'runWeatherDataChecks',
      startDate: null,
      endDate: null,
      kawabeFetched: 0,
      yuasaFetched: 0,
      ebinaFetched: 0,
      kawabeTotal: kawabe.length,
      yuasaTotal: yuasa.length,
      ebinaTotal: ebina.length,
      status: '成功',
      errorMessage: '',
      issueCount: checkResult.issueCount,
    });

    saveLastOperation_(result, false);
    appendLog_(result);
    writeManagementSheet_(result);

    SpreadsheetApp.getActiveSpreadsheet().toast(
      checkResult.issueCount === 0
        ? '問題は見つかりませんでした。'
        : `${checkResult.issueCount}件の確認事項があります。`,
      'データチェック',
      8
    );
  });
}

/**
 * 管理シートだけを最新状態に更新する。
 */
function refreshManagementSheet() {
  ensureOperationalSheets_();
  writeManagementSheet_(loadLastOperation_());
  SpreadsheetApp.getActiveSpreadsheet().toast(
    '管理シートを更新しました。',
    '和歌山気象データ',
    5
  );
}

/**
 * 毎日午前6時頃に実行するトリガーを設定する。
 */
function installWeatherTriggers() {
  installWeatherTriggers_(true);
}

function installWeatherTriggers_(showUi) {
  const functionName = 'scheduledWeatherUpdate';
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  if (showUi) {
    writeManagementSheet_(loadLastOperation_());
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '毎日午前6時頃に実行するトリガーを設定しました。',
      '和歌山気象データ',
      8
    );
  }
}

/**
 * 直近データを取得して既存データと日付で統合する。
 */
function performIncrementalUpdate_(operationType, functionName, showUi) {
  ensureOperationalSheets_();

  const existingKawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
  const existingYuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
  const existingEbina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;

  const latestKawabe = getLatestDateFromData_(existingKawabe);
  const latestYuasa = getLatestDateFromData_(existingYuasa);
  const latestEbina = getLatestDateFromData_(existingEbina);
  const endDate = getYesterday_();
  const initialStart = parseYmd_(WEATHER_CONFIG.HISTORICAL_START_DATE);

  let startDate;
  if (!latestKawabe || !latestYuasa || !latestEbina) {
    // いずれかの生データが空の場合は、初回開始日から復旧する。
    startDate = initialStart;
  } else {
    const oldestLatest = new Date(Math.min(
      latestKawabe.getTime(),
      latestYuasa.getTime(),
      latestEbina.getTime()
    ));

    // 通常は前日を含む直近3日分を再取得する。
    const normalWindowStart = addDays_(
      endDate,
      -(WEATHER_CONFIG.UPDATE_LOOKBACK_DAYS - 1)
    );

    // トリガー失敗などで更新が遅れている場合は、未取得日の先頭まで遡る。
    const firstMissingDate = addDays_(oldestLatest, 1);
    startDate = firstMissingDate < normalWindowStart
      ? firstMissingDate
      : normalWindowStart;

    if (startDate < initialStart) {
      startDate = initialStart;
    }
  }

  validatePeriod_(startDate, endDate);

  const kawabeFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.KAWABE, startDate, endDate);
  const yuasaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.YUASA, startDate, endDate);
  const ebinaFetched = fetchPeriodData_(WEATHER_CONFIG.STATIONS.EBINA, startDate, endDate);

  const mergedKawabe = mergeWeatherData_(existingKawabe, kawabeFetched);
  const mergedYuasa = mergeWeatherData_(existingYuasa, yuasaFetched);
  const mergedEbina = mergeWeatherData_(existingEbina, ebinaFetched);

  writeAllWeatherSheets_(mergedKawabe, mergedYuasa, mergedEbina);
  const checkResult = buildDataCheckSheet_();

  const result = makeOperationResult_({
    operationType: operationType,
    functionName: functionName,
    startDate: startDate,
    endDate: endDate,
    kawabeFetched: kawabeFetched.length,
    yuasaFetched: yuasaFetched.length,
    ebinaFetched: ebinaFetched.length,
    kawabeTotal: mergedKawabe.length,
    yuasaTotal: mergedYuasa.length,
    ebinaTotal: mergedEbina.length,
    status: '成功',
    errorMessage: '',
    issueCount: checkResult.issueCount,
  });

  saveLastOperation_(result, true);
  appendLog_(result);
  writeManagementSheet_(result);

  if (showUi) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `更新完了：${formatYmd_(startDate)}～${formatYmd_(endDate)}`,
      '和歌山気象データ',
      8
    );
  }
}

/**
 * 指定期間を月単位に分け、気象庁の日別ページから取得する。
 */
function fetchPeriodData_(station, startDate, endDate) {
  validatePeriod_(startDate, endDate);

  const results = [];
  const months = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 12, 0, 0);
  const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 12, 0, 0);

  while (cursor <= lastMonth) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    cursor = new Date(year, month, 1, 12, 0, 0);
  }

  for (let offset = 0; offset < months.length; offset += WEATHER_CONFIG.FETCH_BATCH_MONTHS) {
    const batch = months.slice(offset, offset + WEATHER_CONFIG.FETCH_BATCH_MONTHS);
    const requests = batch.map(function (item) {
      return {
        url: buildJmaDailyUrl_(station.precNo, station.blockNo, item.year, item.month),
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MatsusakaFarmWeatherCollector/1.0)' },
      };
    });
    const responses = UrlFetchApp.fetchAll(requests);

    responses.forEach(function (response, index) {
      const item = batch[index];
      const statusCode = response.getResponseCode();
      if (statusCode !== 200) {
        throw new Error(`${station.name} ${item.year}年${item.month}月の取得に失敗しました。HTTP ${statusCode}`);
      }
      const monthData = parseJmaDailyTable_(response.getContentText('UTF-8'), item.year, item.month, station);
      monthData.forEach(function (record) {
        if (record.date >= startDate && record.date <= endDate) results.push(record);
      });
    });

    if (offset + WEATHER_CONFIG.FETCH_BATCH_MONTHS < months.length) {
      Utilities.sleep(WEATHER_CONFIG.REQUEST_INTERVAL_MS);
    }
  }

  return sortWeatherData_(deduplicateWeatherData_(results));
}

function buildJmaDailyUrl_(precNo, blockNo, year, month) {
  return (
    'https://www.data.jma.go.jp/stats/etrn/view/daily_a1.php' +
    `?prec_no=${encodeURIComponent(precNo)}` +
    `&block_no=${encodeURIComponent(blockNo)}` +
    `&year=${encodeURIComponent(year)}` +
    `&month=${encodeURIComponent(month)}` +
    '&day=' +
    '&view=a1'
  );
}

/**
 * 気象庁の日別HTML表を解析する。
 * daily_a1 の列順：
 * 0 日、1 日降水量、6 平均気温、7 最高気温、9 最低気温。
 */
function parseJmaDailyTable_(html, year, month, station) {
  const tableMatch = html.match(/<table[^>]*id=["']tablefix1["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error(`${station.name} ${year}年${month}月の日別表を見つけられませんでした。`);
  }

  const tableHtml = tableMatch[1];
  const rowRegex = /<tr[^>]*class=["'][^"']*mtx[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  const records = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanHtmlCell_(cellMatch[1]));
    }

    if (cells.length < 2) {
      continue;
    }

    const day = parseIntegerValue_(cells[0]);
    if (!day || day < 1 || day > 31) {
      continue;
    }

    const recordDate = new Date(year, month - 1, day, 12, 0, 0);
    if (
      recordDate.getFullYear() !== year ||
      recordDate.getMonth() !== month - 1 ||
      recordDate.getDate() !== day
    ) {
      continue;
    }

    const rain = parseJmaNumericValue_(cells[1]);
    let averageTemperature = null;
    let maximumTemperature = null;
    let minimumTemperature = null;

    if (station.hasTemperature) {
      averageTemperature = cells.length > 6 ? parseJmaNumericValue_(cells[6]) : null;
      maximumTemperature = cells.length > 7 ? parseJmaNumericValue_(cells[7]) : null;
      minimumTemperature = cells.length > 9 ? parseJmaNumericValue_(cells[9]) : null;
    }

    records.push({
      date: recordDate,
      averageTemperature: averageTemperature,
      maximumTemperature: maximumTemperature,
      minimumTemperature: minimumTemperature,
      rainfall: station.hasRainfall ? rain : null,
    });
  }

  if (records.length === 0) {
    throw new Error(`${station.name} ${year}年${month}月の日別データを解析できませんでした。`);
  }

  return records;
}

function cleanHtmlCell_(html) {
  return decodeHtmlEntities_(
    String(html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[\u00A0\s]+/g, ' ')
    .trim();
}

function decodeHtmlEntities_(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&minus;/gi, '-')
    .replace(/&#8722;/g, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    });
}

function parseIntegerValue_(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * 数値以外の記号（///、--、×など）はnullにする。
 * 数値に品質記号が付いている場合は数値部分だけを取得する。
 */
function parseJmaNumericValue_(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value)
    .replace(/[−ー]/g, '-')
    .replace(/,/g, '')
    .trim();

  if (
    normalized === '' ||
    normalized.indexOf('///') !== -1 ||
    normalized.indexOf('×') !== -1 ||
    normalized === '--' ||
    normalized === '…'
  ) {
    return null;
  }

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

/**
 * 生データ3地点と分析シートをまとめて書き直す。
 */
function writeAllWeatherSheets_(kawabeData, yuasaData, ebinaData) {
  writeKawabeSheet_(kawabeData);
  writeYuasaSheet_(yuasaData);
  writeEbinaSheet_(ebinaData);
  writeAnalysisSheet_(kawabeData, yuasaData, ebinaData);
}

function writeKawabeSheet_(data) {
  writeRawWeatherSheet_(
    WEATHER_CONFIG.SHEETS.KAWABE,
    sortWeatherData_(data),
    true
  );
}

function writeYuasaSheet_(data) {
  writeRawWeatherSheet_(
    WEATHER_CONFIG.SHEETS.YUASA,
    sortWeatherData_(data),
    false
  );
}

function writeEbinaSheet_(data) {
  writeRawWeatherSheet_(
    WEATHER_CONFIG.SHEETS.EBINA,
    sortWeatherData_(data),
    true
  );
}

/**
 * 湯浅はB～D列を必ず空白にする。
 */
function writeRawWeatherSheet_(sheetName, data, includeTemperature) {
  const sheet = getOrCreateSheet_(sheetName);
  resetSheet_(sheet);

  sheet.getRange(1, 1, 1, RAW_HEADERS.length).setValues([RAW_HEADERS]);
  styleHeader_(sheet.getRange(1, 1, 1, RAW_HEADERS.length));

  const rows = data.map(function (record) {
    return [
      normalizeDateValue_(record.date),
      includeTemperature ? toSheetValue_(record.averageTemperature) : '',
      includeTemperature ? toSheetValue_(record.maximumTemperature) : '',
      includeTemperature ? toSheetValue_(record.minimumTemperature) : '',
      toSheetValue_(record.rainfall),
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, RAW_HEADERS.length).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/mm/dd');
    sheet.getRange(2, 2, rows.length, 4).setNumberFormat('0.0');
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, RAW_HEADERS.length);
  applyFilter_(sheet, RAW_HEADERS.length, rows.length + 1);
}

/**
 * 生データから分析シートを再生成する。
 */
function writeAnalysisSheet_(kawabeData, yuasaData, ebinaData) {
  const sheet = getOrCreateSheet_(WEATHER_CONFIG.SHEETS.ANALYSIS);
  resetSheet_(sheet);

  sheet.getRange(1, 1, 1, ANALYSIS_HEADERS.length).setValues([ANALYSIS_HEADERS]);
  styleHeader_(sheet.getRange(1, 1, 1, ANALYSIS_HEADERS.length));

  const kawabeMap = weatherDataToMap_(kawabeData);
  const yuasaMap = weatherDataToMap_(yuasaData);
  const ebinaMap = weatherDataToMap_(ebinaData);
  const allKeys = Array.from(new Set(
    Object.keys(kawabeMap).concat(Object.keys(yuasaMap), Object.keys(ebinaMap))
  )).sort();

  if (allKeys.length === 0) {
    sheet.setFrozenRows(1);
    return;
  }

  const firstDate = parseYmd_(allKeys[0]);
  const lastDate = parseYmd_(allKeys[allKeys.length - 1]);
  const dateRange = enumerateDates_(firstDate, lastDate);

  const baseRows = dateRange.map(function (date) {
    const key = formatYmd_(date);
    const kawabe = kawabeMap[key] || null;
    const yuasa = yuasaMap[key] || null;
    const ebina = ebinaMap[key] || null;

    const avgTemp = kawabe ? kawabe.averageTemperature : null;
    const maxTemp = kawabe ? kawabe.maximumTemperature : null;
    const minTemp = kawabe ? kawabe.minimumTemperature : null;
    const diurnalRange = isNumber_(maxTemp) && isNumber_(minTemp)
      ? roundNumber_(maxTemp - minTemp, 1)
      : null;

    return {
      date: date,
      yuasaRain: yuasa ? yuasa.rainfall : null,
      avgTemp: avgTemp,
      maxTemp: maxTemp,
      minTemp: minTemp,
      diurnalRange: diurnalRange,
      kawabeRain: kawabe ? kawabe.rainfall : null,
      ebinaRain: ebina ? ebina.rainfall : null,
      ebinaAvgTemp: ebina ? ebina.averageTemperature : null,
      ebinaMaxTemp: ebina ? ebina.maximumTemperature : null,
      ebinaMinTemp: ebina ? ebina.minimumTemperature : null,
    };
  });

  const avgTempSeries = baseRows.map(function (row) { return row.avgTemp; });
  const yuasaRainSeries = baseRows.map(function (row) { return row.yuasaRain; });
  const avg15 = calculateRollingAverage_(avgTempSeries, 15);
  const avg30 = calculateRollingAverage_(avgTempSeries, 30);
  const rain15 = calculateRollingSum_(yuasaRainSeries, 15);
  const rain30 = calculateRollingSum_(yuasaRainSeries, 30);

  const rows = baseRows.map(function (row, index) {
    return [
      row.date,
      toSheetValue_(row.yuasaRain),
      toSheetValue_(row.avgTemp),
      toSheetValue_(row.maxTemp),
      toSheetValue_(row.minTemp),
      toSheetValue_(row.diurnalRange),
      toSheetValue_(avg15[index]),
      toSheetValue_(avg30[index]),
      toSheetValue_(rain15[index]),
      toSheetValue_(rain30[index]),
      toSheetValue_(row.kawabeRain),
      toSheetValue_(row.ebinaRain),
      toSheetValue_(row.ebinaAvgTemp),
      toSheetValue_(row.ebinaMaxTemp),
      toSheetValue_(row.ebinaMinTemp),
    ];
  });

  sheet.getRange(2, 1, rows.length, ANALYSIS_HEADERS.length).setValues(rows);
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/mm/dd');
  sheet.getRange(2, 2, rows.length, ANALYSIS_HEADERS.length - 1).setNumberFormat('0.0');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, ANALYSIS_HEADERS.length);
  applyFilter_(sheet, ANALYSIS_HEADERS.length, rows.length + 1);
}

/**
 * 対象日を含む直近N日すべてに実測値がある場合のみ平均を返す。
 * 欠測が1日でもあれば空白にする。
 */
function calculateRollingAverage_(values, windowSize) {
  return values.map(function (_, index) {
    if (index < windowSize - 1) {
      return null;
    }

    const window = values.slice(index - windowSize + 1, index + 1);
    if (!window.every(isNumber_)) {
      return null;
    }

    const total = window.reduce(function (sum, value) { return sum + value; }, 0);
    return roundNumber_(total / windowSize, 1);
  });
}

/**
 * 対象日を含む直近N日すべてに実測値がある場合のみ合計を返す。
 * 欠測が1日でもあれば空白にする。
 */
function calculateRollingSum_(values, windowSize) {
  return values.map(function (_, index) {
    if (index < windowSize - 1) {
      return null;
    }

    const window = values.slice(index - windowSize + 1, index + 1);
    if (!window.every(isNumber_)) {
      return null;
    }

    const total = window.reduce(function (sum, value) { return sum + value; }, 0);
    return roundNumber_(total, 1);
  });
}

/**
 * 欠測・重複・日付不整合・湯浅気温列への混入を一覧化する。
 */
function buildDataCheckSheet_() {
  const now = new Date();
  const issues = [];
  const kawabeRead = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE);
  const yuasaRead = readRawData_(WEATHER_CONFIG.SHEETS.YUASA);
  const ebinaRead = readRawData_(WEATHER_CONFIG.SHEETS.EBINA);

  kawabeRead.invalidRows.forEach(function (rowNumber) {
    issues.push(makeIssue_(now, '警告', '日付不正', '川辺', '', `${rowNumber}行目の日付を読み取れません。`, '日付を確認してください。'));
  });
  yuasaRead.invalidRows.forEach(function (rowNumber) {
    issues.push(makeIssue_(now, '警告', '日付不正', '湯浅', '', `${rowNumber}行目の日付を読み取れません。`, '日付を確認してください。'));
  });
  ebinaRead.invalidRows.forEach(function (rowNumber) {
    issues.push(makeIssue_(now, '警告', '日付不正', '海老名', '', `${rowNumber}行目の日付を読み取れません。`, '日付を確認してください。'));
  });

  kawabeRead.duplicateDates.forEach(function (key) {
    issues.push(makeIssue_(now, '警告', '重複日', '川辺', parseYmd_(key), '同じ日付が複数行あります。', '「最新データを更新」を実行すると日付で統合されます。'));
  });
  yuasaRead.duplicateDates.forEach(function (key) {
    issues.push(makeIssue_(now, '警告', '重複日', '湯浅', parseYmd_(key), '同じ日付が複数行あります。', '「最新データを更新」を実行すると日付で統合されます。'));
  });
  ebinaRead.duplicateDates.forEach(function (key) {
    issues.push(makeIssue_(now, '警告', '重複日', '海老名', parseYmd_(key), '同じ日付が複数行あります。', '「最新データを更新」を実行すると日付で統合されます。'));
  });

  yuasaRead.temperatureContamination.forEach(function (item) {
    issues.push(makeIssue_(now, '重要', '湯浅気温混入', '湯浅', item.date, `B～D列に値があります（${item.rowNumber}行目）。`, '湯浅の気温列は空白にしてください。'));
  });

  const kawabeMap = weatherDataToMap_(kawabeRead.data);
  const yuasaMap = weatherDataToMap_(yuasaRead.data);
  const ebinaMap = weatherDataToMap_(ebinaRead.data);
  const expectedStart = parseYmd_(WEATHER_CONFIG.HISTORICAL_START_DATE);
  const kawabeExpectedStart = parseYmd_(WEATHER_CONFIG.STATIONS.KAWABE.startDate);
  const ebinaTemperatureStart = parseYmd_(WEATHER_CONFIG.STATIONS.EBINA.temperatureStartDate);
  const expectedEnd = getYesterday_();

  enumerateDates_(expectedStart, expectedEnd).forEach(function (date) {
    const key = formatYmd_(date);
    const kawabe = kawabeMap[key];
    const yuasa = yuasaMap[key];
    const ebina = ebinaMap[key];

    if (date >= kawabeExpectedStart && !kawabe) {
      issues.push(makeIssue_(now, '警告', '日付欠落', '川辺', date, 'この日の日付行がありません。', '指定期間の再取得を実行してください。'));
    } else if (date >= kawabeExpectedStart) {
      if (!isNumber_(kawabe.averageTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '川辺', date, '平均気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (!isNumber_(kawabe.maximumTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '川辺', date, '最高気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (!isNumber_(kawabe.minimumTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '川辺', date, '最低気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (!isNumber_(kawabe.rainfall)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '川辺', date, '降水量が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
    }

    if (!yuasa) {
      issues.push(makeIssue_(now, '警告', '日付欠落', '湯浅', date, 'この日の日付行がありません。', '指定期間の再取得を実行してください。'));
    } else if (!isNumber_(yuasa.rainfall)) {
      issues.push(makeIssue_(now, '確認', '欠測値', '湯浅', date, '降水量が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
    }

    if (!ebina) {
      issues.push(makeIssue_(now, '警告', '日付欠落', '海老名', date, 'この日の日付行がありません。', '指定期間の再取得を実行してください。'));
    } else {
      if (date >= ebinaTemperatureStart && !isNumber_(ebina.averageTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '海老名', date, '平均気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (date >= ebinaTemperatureStart && !isNumber_(ebina.maximumTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '海老名', date, '最高気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (date >= ebinaTemperatureStart && !isNumber_(ebina.minimumTemperature)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '海老名', date, '最低気温が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
      if (!isNumber_(ebina.rainfall)) {
        issues.push(makeIssue_(now, '確認', '欠測値', '海老名', date, '降水量が空白です。', '気象庁側の欠測か取得状態を確認してください。'));
      }
    }
  });

  const latestKawabe = getLatestDateFromData_(kawabeRead.data);
  const latestYuasa = getLatestDateFromData_(yuasaRead.data);
  const latestEbina = getLatestDateFromData_(ebinaRead.data);
  addLatestDateIssue_(issues, now, '川辺', latestKawabe, expectedEnd);
  addLatestDateIssue_(issues, now, '湯浅', latestYuasa, expectedEnd);
  addLatestDateIssue_(issues, now, '海老名', latestEbina, expectedEnd);

  if (Session.getScriptTimeZone() !== WEATHER_CONFIG.TIME_ZONE) {
    issues.push(makeIssue_(
      now,
      '警告',
      'タイムゾーン',
      'Apps Script',
      '',
      `スクリプトのタイムゾーンが${Session.getScriptTimeZone()}です。`,
      'プロジェクトの設定でAsia/Tokyoに変更してください。'
    ));
  }

  const triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'scheduledWeatherUpdate';
  }).length;
  if (triggerCount !== 1) {
    issues.push(makeIssue_(
      now,
      '警告',
      'トリガー',
      'Apps Script',
      '',
      `scheduledWeatherUpdateのトリガーが${triggerCount}件です。`,
      '「トリガーを再設定」を実行してください。'
    ));
  }

  const sheet = getOrCreateSheet_(WEATHER_CONFIG.SHEETS.CHECK);
  resetSheet_(sheet);
  sheet.getRange(1, 1, 1, CHECK_HEADERS.length).setValues([CHECK_HEADERS]);
  styleHeader_(sheet.getRange(1, 1, 1, CHECK_HEADERS.length));

  if (issues.length > 0) {
    sheet.getRange(2, 1, issues.length, CHECK_HEADERS.length).setValues(issues);
    sheet.getRange(2, 1, issues.length, 1).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    sheet.getRange(2, 5, issues.length, 1).setNumberFormat('yyyy/mm/dd');
  } else {
    sheet.getRange(2, 1, 1, CHECK_HEADERS.length).setValues([[
      now,
      '正常',
      '問題なし',
      '',
      '',
      '確認対象の問題は見つかりませんでした。',
      '',
    ]]);
    sheet.getRange(2, 1).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, CHECK_HEADERS.length);
  applyFilter_(sheet, CHECK_HEADERS.length, Math.max(2, issues.length + 1));

  return { issueCount: issues.length };
}

function makeIssue_(detectedAt, severity, type, location, date, detail, action) {
  return [detectedAt, severity, type, location, date || '', detail, action];
}

function addLatestDateIssue_(issues, now, stationName, latestDate, expectedDate) {
  if (!latestDate) {
    issues.push(makeIssue_(now, '重要', '最新日不足', stationName, '', 'データがありません。', '初回セットアップを実行してください。'));
    return;
  }

  if (formatYmd_(latestDate) !== formatYmd_(expectedDate)) {
    issues.push(makeIssue_(
      now,
      '警告',
      '最新日不足',
      stationName,
      latestDate,
      `最新データが${formatYmd_(latestDate)}です。前日は${formatYmd_(expectedDate)}です。`,
      '最新データを更新してください。'
    ));
  }
}

/**
 * 管理シートを更新する。
 */
function writeManagementSheet_(operationResult) {
  const sheet = getOrCreateSheet_(WEATHER_CONFIG.SHEETS.MANAGEMENT);
  const previousStart = sheet.getRange('B19').getValue() || sheet.getRange('B17').getValue();
  const previousEnd = sheet.getRange('B20').getValue() || sheet.getRange('B18').getValue();

  resetSheet_(sheet);

  const kawabe = readRawData_(WEATHER_CONFIG.SHEETS.KAWABE).data;
  const yuasa = readRawData_(WEATHER_CONFIG.SHEETS.YUASA).data;
  const ebina = readRawData_(WEATHER_CONFIG.SHEETS.EBINA).data;
  const latestKawabe = getLatestDateFromData_(kawabe);
  const latestYuasa = getLatestDateFromData_(yuasa);
  const latestEbina = getLatestDateFromData_(ebina);
  const analysisLatest = getLatestDateFromSheet_(WEATHER_CONFIG.SHEETS.ANALYSIS);
  const issueCount = countCurrentIssues_();
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'scheduledWeatherUpdate';
  });

  const lastSuccessAt = getScriptPropertyDate_('LAST_DATA_SUCCESS_AT');
  const result = operationResult || loadLastOperation_();

  sheet.getRange('A1:B1').merge();
  sheet.getRange('A1').setValue('和歌山気象データ 管理').setFontWeight('bold').setFontSize(15);

  const statusRows = [
    ['現在の状態', result && result.status ? result.status : '未実行'],
    ['最終操作日時', result && result.executedAt ? result.executedAt : ''],
    ['最終データ更新成功日時', lastSuccessAt || ''],
    ['直前の操作', result && result.operationType ? result.operationType : ''],
    ['直前の取得期間', result && result.startDate && result.endDate
      ? `${formatYmd_(result.startDate)}～${formatYmd_(result.endDate)}`
      : ''],
    ['川辺の最新データ日', latestKawabe || ''],
    ['湯浅の最新データ日', latestYuasa || ''],
    ['海老名の最新データ日', latestEbina || ''],
    ['分析シートの最新日', analysisLatest || ''],
    ['川辺の総データ件数', kawabe.length],
    ['湯浅の総データ件数', yuasa.length],
    ['海老名の総データ件数', ebina.length],
    ['現在の確認事項', issueCount],
    ['自動更新トリガー', `毎日 6時頃（現在${triggers.length}件）`],
    ['スクリプトのタイムゾーン', Session.getScriptTimeZone()],
  ];

  sheet.getRange(3, 1, statusRows.length, 2).setValues(statusRows);
  sheet.getRange('A3:A17').setFontWeight('bold');
  sheet.getRange('B4:B5').setNumberFormat('yyyy/mm/dd hh:mm:ss');
  sheet.getRange('B8:B11').setNumberFormat('yyyy/mm/dd');

  sheet.getRange('A18:B18').merge();
  sheet.getRange('A18').setValue('指定期間の再取得').setFontWeight('bold');
  sheet.getRange('A19').setValue('開始日');
  sheet.getRange('A20').setValue('終了日');

  const defaultEnd = getYesterday_();
  const defaultStart = addDays_(defaultEnd, -30);
  sheet.getRange('B19').setValue(previousStart || defaultStart).setNumberFormat('yyyy/mm/dd');
  sheet.getRange('B20').setValue(previousEnd || defaultEnd).setNumberFormat('yyyy/mm/dd');

  sheet.getRange('A22:B22').merge();
  sheet.getRange('A22').setValue(
    'B19・B20に期間を入力し、上部メニュー「気象データ管理」→「指定期間を再取得」を実行してください。'
  );
  sheet.getRange('A24:B24').merge();
  sheet.getRange('A24').setValue(
    '川辺・湯浅・海老名は生データ保存専用です。分析結果・警告・集計値は生データシートに書き込みません。'
  );

  if (result && result.errorMessage) {
    sheet.getRange('A26').setValue('直前のエラー').setFontWeight('bold');
    sheet.getRange('B26').setValue(result.errorMessage);
  }

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 430);
  sheet.getRange('A1:B26').setVerticalAlignment('middle');
  sheet.getRange('A22:B26').setWrap(true);
}

/**
 * ログシートに1行追記する。
 */
function appendLog_(result) {
  const sheet = getOrCreateSheet_(WEATHER_CONFIG.SHEETS.LOG);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  styleHeader_(sheet.getRange(1, 1, 1, LOG_HEADERS.length));
  if (sheet.getLastRow() <= 1) {
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    result.executedAt || new Date(),
    result.operationType || '',
    result.functionName || '',
    result.startDate || '',
    result.endDate || '',
    result.kawabeFetched || 0,
    result.yuasaFetched || 0,
    result.kawabeTotal || 0,
    result.yuasaTotal || 0,
    result.status || '',
    result.errorMessage || '',
    result.ebinaFetched || 0,
    result.ebinaTotal || 0,
  ]);

  const row = sheet.getLastRow();
  sheet.getRange(row, 1).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  sheet.getRange(row, 4, 1, 2).setNumberFormat('yyyy/mm/dd');
  sheet.autoResizeColumns(1, LOG_HEADERS.length);
}

/**
 * 既存の生データを読み込む。
 */
function readRawData_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      data: [],
      duplicateDates: [],
      invalidRows: [],
      temperatureContamination: [],
    };
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const map = {};
  const duplicateSet = new Set();
  const invalidRows = [];
  const temperatureContamination = [];

  values.forEach(function (row, index) {
    const rowNumber = index + 2;
    if (row.every(function (value) { return value === '' || value === null; })) {
      return;
    }

    let date;
    try {
      date = normalizeDateValue_(row[0]);
    } catch (error) {
      invalidRows.push(rowNumber);
      return;
    }

    const key = formatYmd_(date);
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      duplicateSet.add(key);
    }

    if (
      sheetName === WEATHER_CONFIG.SHEETS.YUASA &&
      [row[1], row[2], row[3]].some(function (value) {
        return value !== '' && value !== null;
      })
    ) {
      temperatureContamination.push({ date: date, rowNumber: rowNumber });
    }

    map[key] = {
      date: date,
      averageTemperature: parseSheetNumber_(row[1]),
      maximumTemperature: parseSheetNumber_(row[2]),
      minimumTemperature: parseSheetNumber_(row[3]),
      rainfall: parseSheetNumber_(row[4]),
    };
  });

  return {
    data: sortWeatherData_(Object.keys(map).map(function (key) { return map[key]; })),
    duplicateDates: Array.from(duplicateSet).sort(),
    invalidRows: invalidRows,
    temperatureContamination: temperatureContamination,
  };
}

function parseSheetNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mergeWeatherData_(existingData, fetchedData) {
  const map = weatherDataToMap_(existingData);
  fetchedData.forEach(function (record) {
    map[formatYmd_(record.date)] = cloneWeatherRecord_(record);
  });
  return sortWeatherData_(Object.keys(map).map(function (key) { return map[key]; }));
}

function deduplicateWeatherData_(data) {
  const map = weatherDataToMap_(data);
  return Object.keys(map).map(function (key) { return map[key]; });
}

function weatherDataToMap_(data) {
  const map = {};
  (data || []).forEach(function (record) {
    if (!record || !record.date) {
      return;
    }
    map[formatYmd_(normalizeDateValue_(record.date))] = cloneWeatherRecord_(record);
  });
  return map;
}

function cloneWeatherRecord_(record) {
  return {
    date: normalizeDateValue_(record.date),
    averageTemperature: isNumber_(record.averageTemperature) ? Number(record.averageTemperature) : null,
    maximumTemperature: isNumber_(record.maximumTemperature) ? Number(record.maximumTemperature) : null,
    minimumTemperature: isNumber_(record.minimumTemperature) ? Number(record.minimumTemperature) : null,
    rainfall: isNumber_(record.rainfall) ? Number(record.rainfall) : null,
  };
}

function sortWeatherData_(data) {
  return (data || []).slice().sort(function (a, b) {
    return normalizeDateValue_(a.date).getTime() - normalizeDateValue_(b.date).getTime();
  });
}

function getLatestDateFromData_(data) {
  if (!data || data.length === 0) {
    return null;
  }
  return normalizeDateValue_(sortWeatherData_(data)[data.length - 1].date);
}

function getLatestDateFromSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i][0]) {
      try {
        return normalizeDateValue_(values[i][0]);
      } catch (error) {
        // 上の行を探す。
      }
    }
  }
  return null;
}

function countCurrentIssues_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WEATHER_CONFIG.SHEETS.CHECK);
  if (!sheet || sheet.getLastRow() < 2) {
    return 0;
  }
  const firstType = sheet.getRange(2, 3).getValue();
  if (sheet.getLastRow() === 2 && firstType === '問題なし') {
    return 0;
  }
  return sheet.getLastRow() - 1;
}

function ensureOperationalSheets_() {
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.KAWABE);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.YUASA);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.EBINA);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.ANALYSIS);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.MANAGEMENT);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.LOG);
  getOrCreateSheet_(WEATHER_CONFIG.SHEETS.CHECK);
}

function getOrCreateSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function resetSheet_(sheet) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }
  const dataRange = sheet.getDataRange();
  if (dataRange) {
    dataRange.breakApart();
  }
  sheet.clear();
  sheet.clearConditionalFormatRules();
}

function applyFilter_(sheet, columnCount, rowCount) {
  if (rowCount >= 2) {
    sheet.getRange(1, 1, rowCount, columnCount).createFilter();
  }
}

function styleHeader_(range) {
  range
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
}

function toSheetValue_(value) {
  return isNumber_(value) ? value : '';
}

function isNumber_(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundNumber_(value, digits) {
  if (!isNumber_(value)) {
    return null;
  }
  const factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseYmd_(ymd) {
  const match = String(ymd).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    throw new Error(`日付の形式が正しくありません：${ymd}`);
  }
  return normalizeDateParts_(Number(match[1]), Number(match[2]), Number(match[3]));
}

function normalizeDateValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return normalizeDateParts_(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = String(value).trim().replace(/[\/.]/g, '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    throw new Error(`日付を読み取れません：${value}`);
  }
  return normalizeDateParts_(Number(match[1]), Number(match[2]), Number(match[3]));
}

function normalizeDateParts_(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`存在しない日付です：${year}-${month}-${day}`);
  }
  return date;
}

function formatYmd_(date) {
  return Utilities.formatDate(normalizeDateValue_(date), WEATHER_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function addDays_(date, days) {
  const result = normalizeDateValue_(date);
  result.setDate(result.getDate() + days);
  return normalizeDateValue_(result);
}

function getYesterday_() {
  const now = new Date();
  const todayText = Utilities.formatDate(now, WEATHER_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
  return addDays_(parseYmd_(todayText), -1);
}

function enumerateDates_(startDate, endDate) {
  const dates = [];
  let cursor = normalizeDateValue_(startDate);
  const end = normalizeDateValue_(endDate);
  while (cursor <= end) {
    dates.push(normalizeDateValue_(cursor));
    cursor = addDays_(cursor, 1);
  }
  return dates;
}

function validatePeriod_(startDate, endDate) {
  const start = normalizeDateValue_(startDate);
  const end = normalizeDateValue_(endDate);
  const initialStart = parseYmd_(WEATHER_CONFIG.HISTORICAL_START_DATE);
  const yesterday = getYesterday_();

  if (start > end) {
    throw new Error('開始日は終了日以前にしてください。');
  }
  if (start < initialStart) {
    throw new Error(`開始日は${WEATHER_CONFIG.HISTORICAL_START_DATE}以降にしてください。`);
  }
  if (end > yesterday) {
    throw new Error(`終了日は前日（${formatYmd_(yesterday)}）以前にしてください。`);
  }
}

function makeOperationResult_(values) {
  return {
    executedAt: values.executedAt ? new Date(values.executedAt) : new Date(),
    operationType: values.operationType || '',
    functionName: values.functionName || '',
    startDate: values.startDate ? normalizeDateValue_(values.startDate) : null,
    endDate: values.endDate ? normalizeDateValue_(values.endDate) : null,
    kawabeFetched: Number(values.kawabeFetched || 0),
    yuasaFetched: Number(values.yuasaFetched || 0),
    ebinaFetched: Number(values.ebinaFetched || 0),
    kawabeTotal: Number(values.kawabeTotal || 0),
    yuasaTotal: Number(values.yuasaTotal || 0),
    ebinaTotal: Number(values.ebinaTotal || 0),
    status: values.status || '',
    errorMessage: values.errorMessage || '',
    issueCount: Number(values.issueCount || 0),
  };
}

function saveLastOperation_(result, isDataUpdateSuccess) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('LAST_OPERATION', JSON.stringify(serializeOperationResult_(result)));
  if (isDataUpdateSuccess && result.status === '成功') {
    properties.setProperty('LAST_DATA_SUCCESS_AT', result.executedAt.toISOString());
  }
}

function loadLastOperation_() {
  const text = PropertiesService.getScriptProperties().getProperty('LAST_OPERATION');
  if (!text) {
    return makeOperationResult_({ status: '未実行' });
  }

  try {
    const parsed = JSON.parse(text);
    return makeOperationResult_({
      executedAt: parsed.executedAt || null,
      operationType: parsed.operationType,
      functionName: parsed.functionName,
      startDate: parsed.startDate ? parseYmd_(parsed.startDate) : null,
      endDate: parsed.endDate ? parseYmd_(parsed.endDate) : null,
      kawabeFetched: parsed.kawabeFetched,
      yuasaFetched: parsed.yuasaFetched,
      ebinaFetched: parsed.ebinaFetched,
      kawabeTotal: parsed.kawabeTotal,
      yuasaTotal: parsed.yuasaTotal,
      ebinaTotal: parsed.ebinaTotal,
      status: parsed.status,
      errorMessage: parsed.errorMessage,
      issueCount: parsed.issueCount,
    });
  } catch (error) {
    return makeOperationResult_({
      status: '読込エラー',
      errorMessage: error.message,
    });
  }
}

function serializeOperationResult_(result) {
  return {
    executedAt: result.executedAt ? result.executedAt.toISOString() : null,
    operationType: result.operationType || '',
    functionName: result.functionName || '',
    startDate: result.startDate ? formatYmd_(result.startDate) : null,
    endDate: result.endDate ? formatYmd_(result.endDate) : null,
    kawabeFetched: result.kawabeFetched || 0,
    yuasaFetched: result.yuasaFetched || 0,
    ebinaFetched: result.ebinaFetched || 0,
    kawabeTotal: result.kawabeTotal || 0,
    yuasaTotal: result.yuasaTotal || 0,
    ebinaTotal: result.ebinaTotal || 0,
    status: result.status || '',
    errorMessage: result.errorMessage || '',
    issueCount: result.issueCount || 0,
  };
}

function getScriptPropertyDate_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 同時実行を防止し、エラーもログ・管理シートへ記録する。
 */
function executeWithLock_(operationType, functionName, showUi, callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    const message = '別の更新処理が実行中です。処理終了後にもう一度実行してください。';
    if (showUi) {
      SpreadsheetApp.getUi().alert(message);
    }
    throw new Error(message);
  }

  try {
    callback();
  } catch (error) {
    const kawabeTotal = safeRawCount_(WEATHER_CONFIG.SHEETS.KAWABE);
    const yuasaTotal = safeRawCount_(WEATHER_CONFIG.SHEETS.YUASA);
    const ebinaTotal = safeRawCount_(WEATHER_CONFIG.SHEETS.EBINA);
    const result = makeOperationResult_({
      operationType: operationType,
      functionName: functionName,
      startDate: null,
      endDate: null,
      kawabeFetched: 0,
      yuasaFetched: 0,
      ebinaFetched: 0,
      kawabeTotal: kawabeTotal,
      yuasaTotal: yuasaTotal,
      ebinaTotal: ebinaTotal,
      status: '失敗',
      errorMessage: error && error.message ? error.message : String(error),
      issueCount: countCurrentIssues_(),
    });

    try {
      ensureOperationalSheets_();
      saveLastOperation_(result, false);
      appendLog_(result);
      writeManagementSheet_(result);
    } catch (secondaryError) {
      console.error(secondaryError);
    }

    console.error(error);
    if (showUi) {
      SpreadsheetApp.getUi().alert(`処理に失敗しました。\n\n${result.errorMessage}`);
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function safeRawCount_(sheetName) {
  try {
    return readRawData_(sheetName).data.length;
  } catch (error) {
    return 0;
  }
}
