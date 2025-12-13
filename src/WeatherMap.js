import { MapContainer, TileLayer, Marker, CircleMarker, Popup, Tooltip, useMapEvents, useMap } from "react-leaflet";
import { useState, useEffect, useRef } from "react";
import L from 'leaflet';
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList } from 'recharts';
import {
  Cloud, Sun, CloudSun, CloudRain, CloudSnow, Wind, Droplets, MapPin,
  Search, Menu, Navigation, LayoutTemplate, Server, Database,
  Thermometer, Monitor, Umbrella, Play, Pause, AlertTriangle, Volume2, ExternalLink
} from 'lucide-react';
import './WeatherMap.css';
// Removed duplicate imports of icons from 'lucide-react'
// and the repeated import of './WeatherMap.css'.

// Isolated Clock Component to prevent main app re-renders
function ClockDisplay({ color = '#64748b' }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Accept a color prop so the parent can set white when inside the alert banner.
  return (
    <div style={{ fontSize: '0.8rem', fontWeight: 500, marginTop: 2, color }}>
      {currentTime.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' })}
    </div>
  );
}

// Fix for leaflet.heat requiring global L
if (typeof window !== 'undefined') {
  window.L = L;
  require('leaflet.heat');
}


// Fix for default marker icons when using Leaflet + Webpack / CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

function WeatherMap() {
  const [weather, setWeather] = useState(null);

  // Fetch AQI when a location is selected
  useEffect(() => {
    if (weather && weather.lat && weather.lon && !weather.aqi) {
      // Don't re-fetch if already has AQI or loading
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${weather.lat}&longitude=${weather.lon}&current=us_aqi,pm2_5`;
      fetch(url)
        .then(r => r.json())
        .then(d => {
          if (d.current) {
            setWeather(prev => ({
              ...prev,
              aqi: {
                val: d.current.us_aqi,
                pm25: d.current.pm2_5
              }
            }));
          }
        })
        .catch(e => console.warn('AQI fetch failed', e));
    }
  }, [weather]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultCenter = [35.6895, 139.6917];
  const WARDS_23 = [
    { id: 'chiyoda', name: '千代田区', lat: 35.6938, lon: 139.7530 },
    { id: 'chuo', name: '中央区', lat: 35.6704, lon: 139.7720 },
    { id: 'minato', name: '港区', lat: 35.6581, lon: 139.7516 },
    { id: 'shinjuku', name: '新宿区', lat: 35.6938, lon: 139.7036 },
    { id: 'shibuya', name: '渋谷区', lat: 35.6595, lon: 139.7004 },
    { id: 'meguro', name: '目黒区', lat: 35.6416, lon: 139.6982 },
    { id: 'bunkyo', name: '文京区', lat: 35.7081, lon: 139.7528 },
    { id: 'taito', name: '台東区', lat: 35.7126, lon: 139.7848 },
    { id: 'sumida', name: '墨田区', lat: 35.7101, lon: 139.7976 },
    { id: 'koto', name: '江東区', lat: 35.6690, lon: 139.8170 },
    { id: 'edogawa', name: '江戸川区', lat: 35.6780, lon: 139.8550 },
    { id: 'adachi', name: '足立区', lat: 35.7760, lon: 139.7940 },
    { id: 'katsushika', name: '葛飾区', lat: 35.7360, lon: 139.8470 },
    { id: 'itabashi', name: '板橋区', lat: 35.7520, lon: 139.7060 },
    { id: 'kita', name: '北区', lat: 35.7520, lon: 139.7360 },
    { id: 'nakano', name: '中野区', lat: 35.7060, lon: 139.6650 },
    { id: 'nerima', name: '練馬区', lat: 35.7350, lon: 139.6520 },
    { id: 'ota', name: '大田区', lat: 35.5610, lon: 139.7160 },
    { id: 'setagaya', name: '世田谷区', lat: 35.6469, lon: 139.6530 },
    { id: 'shinagawa', name: '品川区', lat: 35.6190, lon: 139.7390 },
    { id: 'suginami', name: '杉並区', lat: 35.7042, lon: 139.6370 },
    { id: 'toshima', name: '豊島区', lat: 35.7320, lon: 139.7150 },
    { id: 'arakawa', name: '荒川区', lat: 35.7375, lon: 139.7895 }
  ];
  const [wardWeatherList, setWardWeatherList] = useState([]);
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  // Height in px to reserve for the top alert banner so popups can auto-pan below it
  const BANNER_HEIGHT = 56;
  const [bannerHeight, setBannerHeight] = useState(BANNER_HEIGHT);
  // (no custom marquee needed -- native marquee restored)
  // (native marquee restored; no second marquee measurement needed)
  const [dataSourcePreference, setDataSourcePreference] = useState(localStorage.getItem('weatherSourcePref') || 'open-meteo-first');
  const [displayMode, setDisplayMode] = useState(localStorage.getItem('weatherDisplayMode') || 'summary');
  /* const [geocodedWards, setGeocodedWards] = useState(null); // Removed redundant state */
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRadar, setShowRadar] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [radarTile, setRadarTile] = useState(null);

  // Radar Animation State
  const [radarTimestamps, setRadarTimestamps] = useState([]);
  const [radarIndex, setRadarIndex] = useState(-1);
  const [isRadarPlaying, setIsRadarPlaying] = useState(false);
  const animationRef = useRef(null);

  const markerRef = useRef(null);
  const bannerRef = useRef(null);
  // JMA Alert State
  const [bannerAlert, setBannerAlert] = useState(null);
  const [bannerSourceUrl, setBannerSourceUrl] = useState(null);
  const [bannerSourceHumanUrl, setBannerSourceHumanUrl] = useState(null);

  // Measure banner height dynamically and update bannerHeight. This keeps
  // popup/sidebars spacing correct when the banner wraps or changes content.
  useEffect(() => {
    if (!bannerRef.current) {
      setBannerHeight(BANNER_HEIGHT);
      return;
    }
    const el = bannerRef.current;
    const update = () => {
      try {
        const h = el.getBoundingClientRect().height || BANNER_HEIGHT;
        setBannerHeight(h);
      } catch (e) {
        setBannerHeight(BANNER_HEIGHT);
      }
    };
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) ro.disconnect(); else window.removeEventListener('resize', update);
    };
  }, [bannerAlert]);

  // no-op: native marquee will handle scrolling

  // no-op: native marquee will handle scrolling for the second instance as well

  useEffect(() => {
    // Fetch JMA Warnings for Tokyo (130000)
    const src = 'https://www.jma.go.jp/bosai/warning/data/warning/130000.json';
    fetch(src)
      .then(r => r.json())
      .then(d => {
        if (d && d.headlineText) {
          setBannerAlert(d.headlineText);
          setBannerSourceUrl(src);
          // Prefer a human-readable JMA warnings page when available
          // Use the general JMA warning page for Tokyo as a fallback human-readable link
          setBannerSourceHumanUrl('https://www.jma.go.jp/bosai/warning/');
        }
      })
      .catch(console.error);
  }, []);
  // Clock logic moved to separate component to prevent re-renders

  const OM_WEATHER_CODE_DESCRIPTION = {
    0: '晴れ',
    1: '主に晴れ',
    2: '一部曇り',
    3: '曇り',
    45: '霧',
    48: '霧氷',
    51: '小雨',
    53: '中雨',
    55: '大雨',
    56: 'みぞれ',
    57: '凍雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '凍雨',
    67: '凍雨（強）',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '霰',
    80: 'にわか雨',
    81: 'にわか雨（強）',
    82: 'にわか雨（非常に強）',
    85: 'にわか雪',
    86: 'にわか雪（強）',
    95: '雷雨',
    96: '雷雨（雹を伴う）',
    99: '雷雨（大雹を伴う）'
  };

  // Simple translation dictionary for zh / ja / en
  const TRANSLATIONS = {
    en: {
      title: 'Tokyo Weather',
      searchPlaceholder: 'Search place (eg: Shinjuku, Osaka)...',
      statusLabel: 'Current Status',
      loading: 'Loading...',
      clickToShow: 'Click map to view weather',
      locate: 'Show my location',
      dataSource: 'Data Source',
      backend: 'Backend',
      displayContentLabel: 'Display',
      summary: 'Summary',
      details: 'Details',
      mapLayers: 'Map Layers',
      radar: 'Rain Radar',
      heatmap: 'Temperature Heatmap',
      satellite: 'Satellite',
      heatmapLegend: 'Temperature Heatmap Legend',
      wardsProgress: '23 Wards Load Progress',
      clearCache: 'Clear Cache',
      refreshList: 'Refresh List',
      moveToCurrent: 'Move to current location',
      close: 'Close',
      ttsTitle: 'Speak Weather',
      future24h: 'Next 24 hours forecast (temp / humidity / rain)',
      future7d: '7-day forecast',
      today: 'Today',
      tomorrow: 'Tomorrow',
      debugInfo: 'Debug Info',
      none: 'None',
      expandClick: '(click to expand)',
      alertDetails: 'View alert details',
      detailsLabel: 'Details',
      here: 'here',
      unknownWeather: 'unknown weather',
      ttsTemplate: '{greeting}. Currently in {place} the weather is {desc}. Temperature {temp}°C. Precipitation probability next hour {rain}%.',
      speechUnsupported: 'Your browser does not support speech synthesis',
      geoUnsupported: 'Your browser does not support geolocation',
      locDenied: 'Location denied (please allow location permission)',
      locUnavailable: 'Unable to retrieve location (device or network issue)',
      locTimeout: 'Location request timed out, please try again',
      locFallback: 'Location failed, trying network-based fallback',
      ipFallbackUsed: 'Using approximate network location'
    },
    ja: {
      title: 'Tokyo Weather',
      searchPlaceholder: '場所を検索 (例: 新宿区, Osaka)...',
      statusLabel: '現在の状態',
      loading: '読み込み中...',
      clickToShow: '地図をクリックして天気を表示',
      locate: '現在地を表示',
      dataSource: 'データソース',
      backend: 'バックエンド',
      displayContentLabel: '表示内容',
      summary: '概要',
      details: '詳細',
      mapLayers: '地図レイヤー',
      radar: '降水レーダー',
      heatmap: '気温ヒートマップ',
      satellite: '衛星地図',
      heatmapLegend: '気温ヒートマップ凡例',
      wardsProgress: '23区の読み込み進捗',
      clearCache: 'キャッシュをクリア',
      refreshList: 'リストを更新',
      moveToCurrent: '現在地へ移動',
      close: '閉じる',
      ttsTitle: '音声読み上げ',
      future24h: '今後24時間の予報（気温 / 湿度 / 降水）',
      future7d: '今後7日間の予報',
      today: '今日',
      tomorrow: '明日',
      debugInfo: 'デバッグ情報',
      none: 'なし',
      expandClick: '（クリックして展開）',
      alertDetails: '警報の詳細を見る',
      detailsLabel: '詳細',
      here: 'ここ',
      unknownWeather: '不明な天気',
      ttsTemplate: '{greeting}。現在{place}の天気は{desc}です。気温は{temp}度です。今後1時間の降水確率は{rain}%です。',
      speechUnsupported: 'お使いのブラウザは音声合成をサポートしていません',
      geoUnsupported: 'お使いのブラウザは位置情報をサポートしていません',
      locDenied: '位置情報が拒否されました（許可してください）',
      locUnavailable: '位置情報を取得できません（デバイスまたはネットワークの問題）',
      locTimeout: '位置情報の取得がタイムアウトしました。後で再試行してください',
      locFallback: '位置情報の取得に失敗しました。ネットワーク位置情報で代替します',
      ipFallbackUsed: 'ネットワーク位置情報の近似位置を使用しました',
      greeting: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' }
    },
    zh: {
      title: 'Tokyo Weather',
      searchPlaceholder: '搜索地点 (例如: 新宿区, Osaka)...',
      statusLabel: '当前状态',
      loading: '加载中...',
      clickToShow: '点击地图查看天气',
      locate: '定位我的位置',
      dataSource: '数据源',
      backend: '后端',
      displayContentLabel: '显示详情',
      summary: '摘要',
      details: '详细',
      mapLayers: '地图图层',
      radar: '降雨雷达',
      heatmap: '气温热力',
      satellite: '卫星地图',
      heatmapLegend: '气温热力图例',
      wardsProgress: '23区加载进度',
      clearCache: '清除缓存',
      refreshList: '刷新列表',
      moveToCurrent: '定位到当前位置',
      close: '收起',
      ttsTitle: '语音播报',
      future24h: '未来24小时预报 (气温 / 湿度 / 降雨)',
      future7d: '未来7天预报',
      today: '今天',
      tomorrow: '明天',
      debugInfo: '调试信息',
      none: '无',
      expandClick: '(点击展开)',
      alertDetails: '查看告警详情',
      detailsLabel: '详情',
      here: '这里',
      unknownWeather: '未知的天气',
      ttsTemplate: '{greeting}。现在{place}的天气是{desc}。气温{temp}度。未来一小时降水概率{rain}%。',
      speechUnsupported: '您的浏览器不支持语音播报',
      geoUnsupported: '您的浏览器不支持地理位置功能',
      locDenied: '定位被拒绝（请允许位置权限）',
      locUnavailable: '无法获取位置（设备或网络问题）',
      locTimeout: '定位超时，稍后重试',
      locFallback: '定位失败，尝试使用网络定位作为回退',
      ipFallbackUsed: '使用网络定位的近似位置',
      greeting: { morning: '早上好', afternoon: '下午好', evening: '晚上好' }
    }
  };

  const [lang, setLang] = useState(localStorage.getItem('locale') || 'ja');
  function t(key, vars = {}) {
    const raw = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) ?? TRANSLATIONS['en'][key] ?? key;
    return String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }
  function setLanguage(l) { setLang(l); localStorage.setItem('locale', l); }

  function getGreeting(hour) {
    const g = TRANSLATIONS[lang]?.greeting;
    if (g) {
      if (hour < 11) return g.morning;
      if (hour < 18) return g.afternoon;
      return g.evening;
    }
    if (hour < 11) return 'Hello';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function tempToColor(temp) {
    if (temp === null || temp === undefined) return '#1976d2';
    const t = Number(temp);
    if (isNaN(t)) return '#1976d2';
    if (t <= 0) return '#2196f3'; // blue
    if (t <= 10) return '#4fc3f7';
    if (t <= 20) return '#ffeb3b';
    if (t <= 30) return '#ff9800';
    return '#f44336';
  }

  function getWeatherIcon(desc) {
    if (!desc) return <Cloud size={18} color="#94a3b8" />;
    const d = String(desc).toLowerCase();
    const props = { size: 18, color: '#2563eb' };
    if (d.includes('晴') || d.includes('clear') || d.includes('sun')) return <Sun {...props} color="#f59e0b" />;
    if (d.includes('rain') || d.includes('雨') || d.includes('shower')) return <CloudRain {...props} />;
    if (d.includes('snow') || d.includes('雪')) return <CloudSnow {...props} />;
    if (d.includes('thunder') || d.includes('雷')) return <Wind {...props} />; // Lucide doesn't have thunder, using Wind as fallback or maybe Zap
    if (d.includes('fog') || d.includes('mist') || d.includes('雾')) return <Cloud {...props} style={{ opacity: 0.6 }} />;
    return <Cloud {...props} />;
  }

  // Extract hourly data for charts
  function getHourlyData(raw) {
    if (!raw) return [];

    // 1. Try Open-Meteo format
    const om = raw?.openMeteo ?? raw;
    if (om?.hourly?.time) {
      const times = om.hourly.time.slice(0, 24);
      const temps = om.hourly.temperature_2m ? om.hourly.temperature_2m.slice(0, 24) : [];
      const rains = om.hourly.precipitation_probability ? om.hourly.precipitation_probability.slice(0, 24) : [];
      const humidity = om.hourly.relativehumidity_2m ? om.hourly.relativehumidity_2m.slice(0, 24) : [];

      return times.map((t, i) => ({
        time: t.slice(11, 16),
        temp: temps[i] || 0,
        rain: rains[i] || 0,
        humidity: humidity[i] || 0
      }));
    }

    // 2. Try WeatherAPI format (common backend wrapper)
    // Structure: data.forecast.forecastday[0].hour[] -> { time: "YYYY-MM-DD HH:mm", temp_c, chance_of_rain }
    const forecastDays = raw?.forecast?.forecastday;
    if (Array.isArray(forecastDays) && forecastDays.length > 0) {
      // Flatten hours from today and optionally tomorrow to get next 24h roughly
      // For simplicity, just take the first day's hours or concat if needed.
      // Let's just take the first 24 hours available.
      let hours = forecastDays[0].hour || [];
      if (forecastDays[1]?.hour) {
        hours = hours.concat(forecastDays[1].hour);
      }

      // Filter to start from current hour? 
      // For simplicity, just take the next 24 entries from the array (or all if < 24)
      // Ideally we find the one closest to now.
      const nowStr = new Date().toISOString().slice(0, 13); // "2023-12-13T09"
      // WeatherAPI time is "2023-12-13 09:00"

      // extensive implementation might be overkill, let's just return the first 24 items provided
      return hours.slice(0, 24).map(h => ({
        time: h.time.split(' ')[1], // "00:00"
        temp: h.temp_c ?? 0,
        rain: h.chance_of_rain ?? 0
      }));
    }

    return [];
  }

  // Extract daily data for 7-day forecast
  function getDailyData(raw) {
    if (!raw) return [];

    // 1. Try Open-Meteo format
    const om = raw?.openMeteo ?? raw;
    if (om?.daily?.time) {
      const times = om.daily.time;
      const maxs = om.daily.temperature_2m_max || [];
      const mins = om.daily.temperature_2m_min || [];
      const codes = om.daily.weathercode || [];

      return times.map((t, i) => ({
        date: t,
        max: maxs[i],
        min: mins[i],
        code: codes[i],
        desc: OM_WEATHER_CODE_DESCRIPTION[codes[i]] || ''
      }));
    }

    return [];
  }
  /*
    function weatherEmoji(desc) {
      // Legacy emoji function kept just in case, but unused in new UI
      if (!desc) return '❔';
      const d = String(desc).toLowerCase();
      if (d.includes('晴') || d.includes('clear') || d.includes('sun')) return '☀️';
      if (d.includes('cloud') || d.includes('多云') || d.includes('cloudy') || d.includes('clouds')) return '☁️';
      if (d.includes('rain') || d.includes('雨') || d.includes('shower')) return '🌧️';
      if (d.includes('snow') || d.includes('雪')) return '❄️';
      if (d.includes('thunder') || d.includes('雷')) return '⚡';
      if (d.includes('fog') || d.includes('mist') || d.includes('雾')) return '🌫️';
      return '🌡️';
    }
  */
  useEffect(() => {
    const [lat, lon] = defaultCenter;
    // initial load
    fetchWeatherByLatLon(lat, lon);
    // initial fetch of all Tokyo 23 wards (using hardcoded coordinates)
    fetchAllWards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 点击地图触发
  function MapClickHandler() {
    const map = useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        console.log('Map clicked at lat/lon:', lat, lng);

        // First move the map to the clicked location so popup auto-pan works
        setMapCenter([lat, lng]);

        // Then fetch weather for clicked point
        await fetchWeatherByLatLon(lat, lng);

        // Open popup after map finishes panning to ensure marker exists at new center
        try {
          if (map) {
            let opened = false;
            const openFn = () => {
              try { if (markerRef.current) markerRef.current.openPopup(); } catch (e) { }
              opened = true;
            };
            map.once('moveend', openFn);
            // Fallback: if no moveend fired in reasonable time, try opening after 800ms
            setTimeout(() => { if (!opened) openFn(); }, 800);
          } else {
            // No map reference - fallback to timeout-based open
            setTimeout(() => { try { if (markerRef.current) markerRef.current.openPopup(); } catch (e) { } }, 500);
          }
        } catch (e) {
          console.warn('Error ensuring popup open after click', e);
        }
      },
    });
    return null;
  }

  // Set view component to update map center when mapCenter changes
  function MapViewSetter({ center }) {
    const map = useMap();
    useEffect(() => {
      if (center && map) {
        map.flyTo(center, map.getZoom(), { duration: 1.5 });
      }
    }, [center, map]);
    return null;
  }

  // Heatmap Layer Component
  function HeatmapLayer({ data, visible }) {
    const map = useMap();

    useEffect(() => {
      if (!map || !visible) return;

      const points = data
        .filter(w => w.status === 'done' && w.main?.temp !== undefined)
        .map(w => [w.lat, w.lon, (w.main.temp + 10) * 1.5]); // Scale temp to intensity (experimental)

      if (points.length === 0) return;

      const heat = L.heatLayer(points, {
        radius: 40,
        blur: 25,
        maxZoom: 13,
        max: 75, // Adjusted so that ~0C is blue and ~40C is red
        gradient: {
          0.2: '#0000ff',
          0.4: '#00ffff',
          0.6: '#00ff00',
          0.8: '#ffff00',
          1.0: '#ff0000'
        }
      });

      heat.addTo(map);

      return () => {
        // Safe cleanup
        try {
          map.removeLayer(heat);
        } catch (e) {
          console.warn('Heatmap cleanup error', e);
        }
      };
    }, [map, data, visible]);

    return null;
  }

  // Voice Assistant
  function speakWeather() {
    if (!weather) return;
    // Construct the text using translation template
    const place = weather.city || t('here');
    const desc = weather.weatherArray?.[0]?.description || t('unknownWeather');
    const temp = weather.main?.temp ? Math.round(weather.main.temp) : '?';
    const rain = weather.main?.rainProb || 0;

    const hour = new Date().getHours();
    const greeting = getGreeting(hour);

    const text = t('ttsTemplate', { greeting, place, desc, temp, rain });

    // TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop previous
      const u = new SpeechSynthesisUtterance(text);
      // Select language tag for synthesis based on UI lang
      if (lang === 'zh') u.lang = 'zh-CN';
      else if (lang === 'ja') u.lang = 'ja-JP';
      else u.lang = 'en-US';
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } else {
      alert(t('speechUnsupported'));
    }
  }

  // Helper function for Geolocation
  function handleLocateMe() {
    if (!navigator.geolocation) {
      setError(t('geoUnsupported'));
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        await fetchWeatherByLatLon(latitude, longitude);
        setLoading(false);
      },
      async (err) => {
        console.error('geolocation error', err);
        // More specific messages based on error code
        if (err && err.code === 1) {
          setError(t('locDenied'));
          setLoading(false);
          return;
        }
        if (err && err.code === 2) {
          setError(t('locUnavailable'));
        } else if (err && err.code === 3) {
          setError(t('locTimeout'));
        } else {
          setError(t('locFallback'));
        }

        // Fallback: try IP-based approximate geolocation (best-effort)
        try {
          const resp = await fetch('https://ipapi.co/json/');
          if (resp.ok) {
            const js = await resp.json();
            const lat = parseFloat(js.latitude);
            const lon = parseFloat(js.longitude);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
              setError(t('ipFallbackUsed'));
              setMapCenter([lat, lon]);
              await fetchWeatherByLatLon(lat, lon);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('IP fallback failed', e);
        }

        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  // Reverse geocode: try to resolve lat/lon into a place name (city/town/village)
  // Note: Nominatim is free but has usage limits; for production or heavy use get an API key or use your backend.
  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=jsonv2`;
      const res = await fetch(url, {
        headers: {
          // Avoid setting a custom User-Agent in browsers; Nominatim asks for an identifying header if possible.
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      if (!res.ok) return null;
      const json = await res.json();
      // json.address may contain city, town, village, county
      const addr = json?.address ?? {};
      const place = addr.city ?? addr.town ?? addr.village ?? addr.county ?? json?.display_name ?? null;
      return place;
    } catch (e) {
      console.warn('reverseGeocode error', e);
      return null;
    }
  }

  // Fetch weather data (non-stateful) using same logic as our primary function
  async function getWeatherData(lat, lon, knownCityName = null) {
    // Helper to fetch Open-Meteo
    async function fetchOpenMeteo() {
      try {
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true&hourly=relativehumidity_2m,temperature_2m,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const omr = await fetch(openMeteoUrl);
        if (omr.ok) {
          const omData = await omr.json();
          const current = omData?.current_weather ?? {};
          let humidity = null;
          let rainProb = null;
          if (omData?.hourly?.time) {
            const times = omData.hourly.time;
            let idx = times.indexOf(current.time);
            if (idx === -1) {
              // rough fallback
              idx = times.findIndex(t => t.startsWith(current.time.slice(0, 13)));
              if (idx === -1) idx = 0;
            }
            if (omData.hourly.relativehumidity_2m) {
              humidity = omData.hourly.relativehumidity_2m[idx];
            }
            if (omData.hourly.precipitation_probability) {
              rainProb = omData.hourly.precipitation_probability[idx] || 0;
            }
          }

          const code = current?.weathercode ?? null;
          const description = OM_WEATHER_CODE_DESCRIPTION[code] ?? `code:${code}`;
          // Use known name if provided, otherwise geocode or fallback
          const cityName = knownCityName ?? (await reverseGeocode(lat, lon)) ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
          const weatherArray = [{ description }];
          const windSpeed = current?.windspeed ?? null;
          const windDirection = current?.winddirection ?? null;
          const main = { temp: current?.temperature ?? null, humidity, windSpeed, windDirection, rainProb };
          return { city: cityName, weatherArray, main, lat, lon, raw: { openMeteo: omData }, source: 'open-meteo' };
        }
      } catch (err) {
        console.warn('Open-Meteo request failed:', err);
      }
      return null;
    }

    // Helper to fetch Backend
    async function fetchBackend() {
      try {
        // Only one attempt to backend
        const res = await fetch(`https://backend1212.onrender.com/weather?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const json = await res.json();
          const d = json?.data ?? json?.result ?? json;
          let city = d?.name ?? d?.city ?? d?.location?.name ?? 'Unknown';
          let weatherArray = d?.weather ?? d?.weatherArray ?? [];
          let main = d?.main ?? d?.current ?? {};
          if (d?.current) {
            weatherArray = [{ description: d.current?.condition?.text ?? d.current?.weather_descriptions?.[0] }].filter(Boolean);
            const _windSpeed = d.current?.wind_kph ?? d.current?.wind?.speed ?? d.wind?.speed ?? d.wind_speed ?? d.current?.windspeed ?? null;
            const _windDir = d.current?.wind_degree ?? d.current?.wind_deg ?? d.current?.wind_dir ?? d.current?.winddir ?? d.wind?.deg ?? d.winddirection ?? null;
            main = { temp: d.current?.temp_c ?? d.current?.temp, humidity: d.current?.humidity, windSpeed: _windSpeed, windDirection: _windDir };
            city = city === 'Unknown' ? (d.location?.name ?? 'Unknown') : city;
          }
          if (knownCityName) city = knownCityName;
          else if (!city || city === 'Unknown') city = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

          return { city, weatherArray, main, lat, lon, raw: d, source: 'backend' };
        }
      } catch (err) {
        console.warn('Backend lat/lon request failed', err);
      }
      return null;
    }

    try {
      const preferBackend = dataSourcePreference === 'backend-first';
      let result = null;

      if (preferBackend) {
        result = await fetchBackend();
        if (!result) result = await fetchOpenMeteo();
      } else {
        result = await fetchOpenMeteo();
        if (!result) result = await fetchBackend();
      }

      if (result) return result;

      // No provider succeeded
      return { city: knownCityName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, weatherArray: [], main: {}, lat, lon, raw: {}, source: 'none' };
    } catch (e) {
      console.error('getWeatherData failed', e);
      return { city: knownCityName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, weatherArray: [], main: {}, lat, lon, raw: { error: String(e) }, source: 'error' };
    }
  }

  async function fetchAllWards() {
    const wardList = WARDS_23;
    // initialize list with loading status
    setWardWeatherList(wardList.map(w => ({ id: w.id, name: w.name, lat: w.lat, lon: w.lon, status: 'idle', weatherArray: [], main: {}, raw: null, source: null })));

    // Simple cache helpers
    function loadCache() {
      try {
        const raw = localStorage.getItem('wardsWeatherCache');
        if (!raw) return {};
        return JSON.parse(raw);
      } catch (e) { return {}; }
    }
    function saveCache(cache) {
      try { localStorage.setItem('wardsWeatherCache', JSON.stringify(cache)); } catch (e) { /* noop */ }
    }

    const cache = loadCache();
    // Use strictly sequential processing to avoid Open-Meteo rate limits (429)
    // and network congestion.
    for (const w of wardList) {
      // If cached and fresh, use it
      const cached = cache?.[w.id];
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
        setWardWeatherList(prev => prev.map(p => p.id === w.id ? ({ ...p, ...cached.data, status: 'done' }) : p));
        continue;
      }

      // mark loading
      setWardWeatherList(prev => prev.map(p => p.id === w.id ? ({ ...p, status: 'loading' }) : p));

      try {
        // Add a small delay to respect API rate limits
        await new Promise(r => setTimeout(r, 200));

        // Pass a timeout signal to getWeatherData if possible, or just rely on internal fetch
        // Since we can't easily change getWeatherData signature without larger refactor, 
        // we assume getWeatherData handles one request.
        // But we want to ensure we don't proceed too fast.
        const r = await getWeatherData(w.lat, w.lon, w.name);

        const entry = { ...r, id: w.id, name: w.name };
        setWardWeatherList(prev => prev.map(p => p.id === w.id ? ({ ...p, ...entry, status: 'done' }) : p));

        // cache it
        cache[w.id] = { ts: Date.now(), data: entry };
        saveCache(cache);
      } catch (e) {
        setWardWeatherList(prev => prev.map(p => p.id === w.id ? ({ ...p, status: 'error', raw: { error: String(e) } }) : p));
      }
    }
  }

  /* ensureGeocodedWards removed */

  async function fetchWeatherByLatLon(lat, lon) {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeatherData(lat, lon);
      setWeather(data);

      if (data.source === 'error') {
        setError(data.raw?.error || 'Unknown error');
      } else if (data.source === 'none') {
        setError('天気データを取得できません（すべてのソースが失敗しました）');
      }

      // Auto-open popup
      setTimeout(() => { try { if (markerRef.current) markerRef.current.openPopup(); } catch (e) { } }, 300);

    } catch (err) {
      console.error('Failed to fetch weather:', err);
      setError('天気データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    if (e.key === 'Enter') {
      const q = searchQuery.trim();
      if (!q) return;
      try {
        setLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`;
        const r = await fetch(url);
        const arr = await r.json();
        if (arr && arr.length > 0) {
          const { lat, lon } = arr[0];
          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);
          setMapCenter([latNum, lonNum]);
          await fetchWeatherByLatLon(latNum, lonNum);
        } else {
          setError('その場所は見つかりませんでした');
        }
      } catch (err) {
        console.error(err);
        setError('検索に失敗しました');
      } finally {
        setLoading(false);
      }
    }
  }

  // Render arbitrary JSON in a readable format with limited depth
  function RenderData({ data, depth = 0, name = '' }) {
    if (data === undefined || data === null) return <span style={{ color: '#666' }}>なし</span>;
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return <span>{String(data)}</span>;
    if (Array.isArray(data)) {
      return (
        <div style={{ marginLeft: 12 }}>
          {data.map((item, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <strong>[{idx}] </strong>
              <RenderData name={String(name)} data={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      );
    }
    if (typeof data === 'object') {
      if (depth >= 4) return <span>{JSON.stringify(data)}</span>;
      return (
        <div style={{ marginLeft: 6 }}>
          {Object.entries(data).map(([k, v]) => {
            const childName = k;
            if (childName.toLowerCase().includes('hourly')) {
              return (
                <details key={k} style={{ marginBottom: 6 }}>
                  <summary style={{ cursor: 'pointer' }}>{k} （クリックして展開）</summary>
                  <div style={{ marginLeft: 12 }}>
                    <RenderData name={childName} data={v} depth={depth + 1} />
                  </div>
                </details>
              );
            }
            return (
              <div key={k} style={{ marginBottom: 6 }}>
                <strong style={{ display: 'inline-block', minWidth: 120 }}>{k}: </strong>
                <RenderData name={childName} data={v} depth={depth + 1} />
              </div>
            );
          })}
        </div>
      );
    }
    return <span>{String(data)}</span>;
  }

  // RainViewer Radar Logic
  useEffect(() => {
    if (!showRadar) {
      setRadarTile(null);
      setIsRadarPlaying(false);
      return;
    }

    // Fetch latest available radar timestamp
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        if (data.radar?.past?.length) {
          const past = data.radar.past;
          setRadarTimestamps(past);
          setRadarIndex(past.length - 1); // Start at latest

          const latest = past[past.length - 1];
          const host = data.host || 'https://tilecache.rainviewer.com';
          setRadarTile(`${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`);
        }
      })
      .catch(e => console.error('Radar init failed', e));
  }, [showRadar]);

  // Radar Animation Loop
  useEffect(() => {
    if (isRadarPlaying && radarTimestamps.length > 0) {
      animationRef.current = setInterval(() => {
        setRadarIndex(prev => {
          const next = prev + 1;
          return next >= radarTimestamps.length ? 0 : next;
        });
      }, 500); // 500ms per frame
    } else {
      clearInterval(animationRef.current);
    }
    return () => clearInterval(animationRef.current);
  }, [isRadarPlaying, radarTimestamps]);

  // Update tile when index changes
  useEffect(() => {
    if (radarIndex >= 0 && radarTimestamps.length > 0) {
      const item = radarTimestamps[radarIndex];
      // We need to re-fetch or store host... simplified assumption: host is constant or we hardcode it
      // Actually, let's just stick to the specific format known
      // Or better: store full tile URL objects? For now let's reconstruct it.
      // host is https://tilecache.rainviewer.com
      const host = 'https://tilecache.rainviewer.com';
      setRadarTile(`${host}${item.path}/256/{z}/{x}/{y}/2/1_1.png`);
    }
  }, [radarIndex, radarTimestamps]);

  // Dynamic Sidebar Theme Class
  const getSidebarThemeClass = () => {
    if (!weather) return ''; // default
    const desc = weather.weatherArray?.[0]?.description?.toLowerCase() || '';
    if (desc.includes('sun') || desc.includes('clear') || desc.includes('晴')) {
      return 'theme-sun';
    }
    if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('雨')) {
      return 'theme-rain';
    }
    if (desc.includes('snow') || desc.includes('雪')) {
      return 'theme-cloud'; // sharing cloud/snow logic for now or add theme-snow
    }
    if (desc.includes('cloud') || desc.includes('overcast') || desc.includes('Cloud')) {
      return 'theme-cloud';
    }
    return '';
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: 'relative', overflow: 'hidden' }}>

      {/* Current Time Display - Top Left (only when no banner present) */}
      {!bannerAlert && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2001,
          padding: '6px 12px',
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#1e293b',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <ClockDisplay />
        </div>
      )}

      {/* JMA Alert Banner */}
      {bannerAlert && (
        <div ref={bannerRef} style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          background: 'rgba(239, 68, 68, 0.9)', // Red translucent
          color: 'white',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.9rem',
          fontWeight: 600,
          backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 12 }}>
            <ClockDisplay color="#fff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', gap: 8, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flex: 1, maxWidth: 800 }}>
              <AlertTriangle size={18} fill="white" stroke="rgba(239, 68, 68, 0.9)" />
              <marquee scrollamount="5" style={{ flex: 1 }}>
                {bannerAlert}
              </marquee>
            </div>

            {/* Source Link Button on the far right of banner */}
            {(bannerSourceHumanUrl || bannerSourceUrl) && (
              <a
                href={bannerSourceHumanUrl || bannerSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="banner-source-btn"
                title="警報の詳細を見る"
                style={{ marginLeft: 12 }}
              >
                <ExternalLink size={16} />
                <span style={{ marginLeft: 6 }}>詳細</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Sidebar Toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          top: bannerAlert ? bannerHeight + 12 : 24
        }}
        title={sidebarOpen ? '閉じる' : '展開'}
        aria-expanded={sidebarOpen}
        aria-controls="weather-sidebar"
      >
        <Menu size={16} />
      </button>

      {/* Glassmorphism Sidebar */}
      <div
        className={`weather-sidebar ${!sidebarOpen ? 'collapsed' : ''} theme-base ${getSidebarThemeClass()}`}
        style={{
          top: bannerAlert ? bannerHeight + 18 : 30
        }}
      >
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="glass-icon">
                <CloudSun size={20} color="#2563eb" />
              </div>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, background: 'linear-gradient(to right, #1e293b, #334155)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('title')}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className={`btn ${lang === 'zh' ? 'active' : ''}`} onClick={() => setLanguage('zh')} title="中文">中文</button>
              <button className={`btn ${lang === 'ja' ? 'active' : ''}`} onClick={() => setLanguage('ja')} title="日本語">日本語</button>
              <button className={`btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')} title="English">EN</button>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
              title={t('close')}
            >
              <span style={{ fontSize: '1.2rem' }}>×</span>
            </button>
          </div>
        </div>

        {/* Search Box */}
        <div className="search-box">
          <Search className="search-icon" />
          <input
            className="search-input"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        {/* Status Card */}
        <div className="control-group">
          <div className="control-label">{t('statusLabel')}</div>
          <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>
            {loading ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="spinner" /> {t('loading')}</div> :
              error ? <span style={{ color: '#ef4444' }}>⚠️ {error}</span> :
                (weather ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={16} /> {weather.city}</span> : t('clickToShow'))}
          </div>
          <button className="btn" onClick={handleLocateMe} style={{ width: '100%', justifyContent: 'center' }}>
            <Navigation size={14} /> {t('locate')}
          </button>
        </div>

        {/* Filters & Controls */}
        <div className="control-group">
          <div className="control-label">{t('dataSource')}</div>
          <div className="button-group">
            <button
              className={`btn ${dataSourcePreference === 'open-meteo-first' ? 'active' : ''}`}
              onClick={() => { setDataSourcePreference('open-meteo-first'); localStorage.setItem('weatherSourcePref', 'open-meteo-first'); fetchAllWards(); }}
            >
              <Database size={14} /> Open-Meteo
            </button>
            <button
              className={`btn ${dataSourcePreference === 'backend-first' ? 'active' : ''}`}
              onClick={() => { setDataSourcePreference('backend-first'); localStorage.setItem('weatherSourcePref', 'backend-first'); fetchAllWards(); }}
            >
              <Server size={14} /> {t('backend')}
            </button>
          </div>
        </div>

        <div className="control-group">
          <div className="control-label">{t('displayContentLabel')}</div>
          <div className="button-group">
            <button
              className={`btn ${displayMode === 'summary' ? 'active' : ''}`}
              onClick={() => { setDisplayMode('summary'); localStorage.setItem('weatherDisplayMode', 'summary'); }}
            >
              概要
            </button>
            <button
              className={`btn ${displayMode === 'detail' ? 'active' : ''}`}
              onClick={() => { setDisplayMode('detail'); localStorage.setItem('weatherDisplayMode', 'detail'); }}
            >
              詳細
            </button>
          </div>
          <div className="control-label">{t('mapLayers')}</div>
          <div className="button-group">
            <button
              className={`btn ${showRadar ? 'active' : ''}`}
              onClick={() => setShowRadar(!showRadar)}
            >
              <Umbrella size={14} /> {t('radar')}
            </button>
            {showRadar && radarTimestamps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                <button
                  className="btn"
                  style={{ padding: '4px 8px', height: 28 }}
                  onClick={() => setIsRadarPlaying(!isRadarPlaying)}
                >
                  {isRadarPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <div style={{ display: 'flex', gap: 1 }}>
                  {radarTimestamps.map((_, i) => (
                    <div key={i} style={{
                      width: 3, height: 12,
                      borderRadius: 1,
                      background: i === radarIndex ? '#3b82f6' : '#e2e8f0',
                      transition: 'background 0.2s'
                    }} />
                  ))}
                </div>
              </div>
            )}
            <button
              className={`btn ${showHeatmap ? 'active' : ''}`}
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <Thermometer size={14} /> {t('heatmap')}
            </button>
            <button
              className={`btn ${is3DMode ? 'active' : ''}`}
              onClick={() => setIs3DMode(!is3DMode)}
            >
              <MapPin size={14} /> {t('satellite')}
            </button>
          </div>
        </div>

        {/* Heatmap Legend */}
        {showHeatmap && (
          <div className="control-group">
            <div className="control-label">{t('heatmapLegend')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                height: 12,
                width: '100%',
                borderRadius: 6,
                background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)'
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                <span>0°C</span>
                <span>10°</span>
                <span>20°</span>
                <span>30°</span>
                <span>40°C</span>
              </div>
            </div>
          </div>
        )}

        {/* 23 Wards Progress */}
        <div className="control-group">
          <div className="control-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>23区の読み込み進捗</span>
            <span>{wardWeatherList.filter(w => w.status === 'done').length} / {wardWeatherList.length || 23}</span>
          </div>
          <div className="wards-progress">
            <div
              className="wards-progress-bar"
              style={{ width: `${(wardWeatherList.filter(w => w.status === 'done').length / 23) * 100}%` }}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn" onClick={async () => { localStorage.removeItem('wardsWeatherCache'); fetchAllWards(); }}>
              {t('clearCache')}
            </button>
            <button className="btn" onClick={() => fetchAllWards()}>
              {t('refreshList')}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Location Button */}
      <button
        className="location-fab"
        title="現在地へ移動"
        onClick={handleLocateMe}
      >
        <Navigation size={24} />
      </button>

      {/* Map Wrapper */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0
      }}>
        <MapContainer
          center={mapCenter}
          zoom={11}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <MapViewSetter center={mapCenter} />
          <MapClickHandler />
          <HeatmapLayer data={wardWeatherList} visible={showHeatmap} />

          {/* Base Layer: Switch between Light and Satellite */}
          <TileLayer
            key={is3DMode ? 'satellite' : 'light'}
            url={is3DMode
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Radar Layer */}
          {bannerAlert && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2000,
              background: 'rgba(239, 68, 68, 0.9)', // Red translucent
              color: 'white',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: '0.9rem',
              fontWeight: 600,
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              {/* Reserve left space so the scrolling marquee doesn't collide with the clock */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 120, width: '100%', justifyContent: 'center' }}>
                <AlertTriangle size={18} fill="white" stroke="rgba(239, 68, 68, 0.9)" />
                <marquee scrollamount="5" style={{ flex: 1, maxWidth: 800 }}>
                  {bannerAlert}
                </marquee>
              </div>
            </div>
          )}
          {wardWeatherList.map(w => {
            const temp = w.main?.temp ?? null;
            const desc = (w.main?.desc || '').toString();
            let iconChar = '☀️';
            let rainProb = w.main?.rainProb ?? 0;
            const bgColor = (typeof temp === 'number' && !isNaN(temp)) ? (temp <= 0 ? '#60a5fa' : temp >= 30 ? '#f87171' : '#fef3c7') : '#fff';
            if (desc.includes('Cloud') || desc.includes('Overcast')) iconChar = '☁️';
            if (desc.includes('Rain') || desc.includes('Drizzle')) iconChar = '🌧️';
            if (desc.includes('Snow')) iconChar = '❄️';
            if (rainProb >= 50) iconChar = '🌧️'; // Force rain icon if high probability

            // Always show rain probability
            const rainColor = rainProb > 0 ? '#1e40af' : '#94a3b8';
            const rainWeight = rainProb > 0 ? 'bold' : 'normal';
            const rainIndicator = `<span style="font-size:0.7em; color:${rainColor}; font-weight:${rainWeight}">☂️${rainProb}%</span>`;

            // Wind Direction
            const windDir = w.main?.windDirection ?? 0;
            const windSpd = w.main?.windSpeed ?? 0;
            const windArrow = `<div style="transform: rotate(${windDir}deg); display:inline-block; font-size: 10px;">⬇️</div>`; // Down arrow correctly points with wind when rotated

            const customIcon = L.divIcon({
              className: 'custom-weather-icon',
              html: `
               <div style="
                 background-color: rgba(255, 255, 255, 0.9);
                 border: 2px solid ${bgColor};
                 border-radius: 8px;
                 padding: 4px;
                 text-align: center;
                 box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                 min-width: 60px;
                 display: flex;
                 flex-direction: column;
                 align-items: center;
                 justify-content: center;
                 line-height: 1.2;
               ">
                 <div style="font-size: 1.2em; margin-bottom: 2px;">${iconChar}</div>
                 <div style="font-weight: bold; color: #1e293b; font-size: 0.9em;">${temp}°C</div>
                 ${rainIndicator ? `<div style="margin-top:2px;">${rainIndicator}</div>` : ''}
                 <div style="display:flex; alignItems:center; gap:2px; margin-top:2px; font-size:0.65em; color:#64748b;">
                   ${windArrow} <span>${windSpd}km/h</span>
                 </div>
                 <div style="font-size: 0.7em; color: #64748b; margin-top: 2px;">${w.name}</div>
               </div>
             `,
              iconSize: [60, 75], // Increased height for wind info
              iconAnchor: [30, 37]
            });

            return (
              <Marker
                key={w.id}
                position={[w.lat, w.lon]}
                icon={customIcon}
                eventHandlers={{
                  click: () => {
                    setWeather(w);
                    if (sidebarOpen) setSidebarOpen(true);
                  }
                }}
              >
              </Marker>
            );
          })}

          {/* Main Selection Marker */}
          {weather && (
            <Marker ref={markerRef} position={[weather.lat, weather.lon]}>
              <Popup
                minWidth={300}
                maxWidth={300}
                // Ensure popup auto-pans keeping space for the top alert banner
                autoPanPaddingTopLeft={[0, bannerHeight + 8]}
                autoPanPadding={[0, bannerHeight + 8]}
                keepInView={true}
              >
                <div className="popup-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 className="popup-title">
                        {weather.city}
                        <button
                          onClick={speakWeather}
                          className="btn"
                          style={{ marginLeft: 8, padding: '2px 6px', height: 24, verticalAlign: 'middle', border: 'none', background: 'transparent', color: '#2563eb' }}
                          title="音声読み上げ"
                        >
                          <Volume2 size={16} />
                        </button>
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {Number(weather.lat).toFixed(3)}, {Number(weather.lon).toFixed(3)}
                      </div>
                    </div>
                    {/* AQI Badge */}
                    {weather.aqi && (
                      <div style={{
                        background: weather.aqi.val <= 50 ? '#ecfccb' : weather.aqi.val <= 100 ? '#fef9c3' : '#fee2e2',
                        color: weather.aqi.val <= 50 ? '#3f6212' : weather.aqi.val <= 100 ? '#854d0e' : '#991b1b',
                        padding: '4px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                        border: `1px solid ${weather.aqi.val <= 50 ? '#d9f99d' : weather.aqi.val <= 100 ? '#fde047' : '#fca5a5'}`
                      }}>
                        AQI {weather.aqi.val} (PM2.5: {weather.aqi.pm25})
                      </div>
                    )}
                  </div>
                </div>

                <div className="popup-grid">
                  <div className="popup-item">
                    <Thermometer size={16} color="#ef4444" />
                    <span className="popup-value">{weather?.main?.temp ?? 'N/A'}°C</span>
                  </div>
                  <div className="popup-item">
                    <Droplets size={16} color="#3b82f6" />
                    <span className="popup-value">{weather?.main?.humidity ?? 'N/A'}%</span>
                  </div>
                  <div className="popup-item">
                    <Wind size={16} color="#64748b" />
                    <span className="popup-value">{weather?.main?.windSpeed ?? 'N/A'} km/h</span>
                  </div>
                  <div className="popup-item">
                    {getWeatherIcon(weather?.weatherArray?.[0]?.description)}
                    <span>{weather?.weatherArray?.[0]?.description ?? 'Unknown'}</span>
                  </div>
                </div>

                {/* Chart Section */}
                {getHourlyData(weather.raw).length > 0 && (
                  <div style={{ marginTop: 16, height: 160 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: '#64748b' }}>今後24時間の予報（気温 / 湿度 / 降水）</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={getHourlyData(weather.raw)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        {/* Left Axis: Temperature */}
                        <YAxis yAxisId="left" hide domain={['auto', 'auto']} />
                        {/* Right Axis: Rain Probability & Humidity (0-100) */}
                        <YAxis yAxisId="right" orientation="right" hide domain={[0, 100]} />

                        <RechartsTooltip
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                          formatter={(value, name) => {
                            if (name === 'temp') return [`${value}°C`, '気温'];
                            if (name === 'rain') return [`${value}%`, '降水確率'];
                            if (name === 'humidity') return [`${value}%`, '湿度'];
                            return [value, name];
                          }}
                        />

                        {/* Rain Probability Bar */}
                        <Bar
                          yAxisId="right"
                          dataKey="rain"
                          barSize={8}
                          radius={[2, 2, 0, 0]}
                          opacity={0.8}
                        >
                          {
                            getHourlyData(weather.raw).map((entry, index) => {
                              const val = entry.rain;
                              let fill = '#dbeafe'; // < 20%
                              if (val >= 20) fill = '#93c5fd'; // 20-50%
                              if (val >= 50) fill = '#3b82f6'; // 50-80%
                              if (val >= 80) fill = '#1e3a8a'; // > 80% (Dark Blue)
                              return <Cell key={`cell-${index}`} fill={fill} />;
                            })
                          }
                          <LabelList
                            dataKey="rain"
                            position="top"
                            content={(props) => {
                              const { x, y, value, width } = props;
                              if (value < 50) return null;
                              const content = value >= 80 ? '☂️☂️' : '☂️';
                              return (
                                <text x={x + width / 2} y={y - 5} fill="#1e3a8a" textAnchor="middle" fontSize={10}>
                                  {content}
                                </text>
                              );
                            }}
                          />
                        </Bar>

                        {/* Humidity Line */}
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="humidity"
                          stroke="#60a5fa"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#60a5fa' }}
                          strokeDasharray="3 3"
                          name="humidity"
                        />

                        {/* Temperature Line */}
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="temp"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 7-Day Forecast Section */}
                {getDailyData(weather.raw).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, color: '#64748b' }}>今後7日間の予報</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {getDailyData(weather.raw).slice(0, 7).map((day, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          padding: '4px 0',
                          borderBottom: idx < 6 ? '1px dashed #f1f5f9' : 'none'
                        }}>
                          <div style={{ width: 80, color: '#334155' }}>
                            {idx === 0 ? '今日' : idx === 1 ? '明日' : day.date.slice(5)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            {getWeatherIcon(day.desc)}
                            <span style={{ color: '#64748b' }}>{day.desc}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontWeight: 500 }}>
                            <span style={{ color: '#ef4444' }}>{Math.round(day.max)}°</span>
                            <span style={{ color: '#3b82f6' }}>{Math.round(day.min)}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {displayMode === 'detail' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <details>
                      <summary style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>デバッグ情報</summary>
                      <pre style={{ fontSize: '0.7rem', maxHeight: 100, overflow: 'auto', marginTop: 4 }}>
                        {JSON.stringify(weather.raw, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default WeatherMap;
