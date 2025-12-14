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

// 在文件顶部添加防抖工具函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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
  const [radarPlaySpeed, setRadarPlaySpeed] = useState(1000); // 默认 1 秒一帧
  const animationRef = useRef(null);

  const markerRef = useRef(null);
  const mapRef = useRef(null); // 用于存储地图实例
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

    // 使用防抖来减少更新频率
    const update = debounce(() => {
      try {
        const h = el.getBoundingClientRect().height || BANNER_HEIGHT;
        setBannerHeight(h);
      } catch (e) {
        setBannerHeight(BANNER_HEIGHT);
      }
    }, 100); // 100ms 防抖

    // 初始测量
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

  // 获取地图实例的组件
  function MapRefSetter() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }

  // 直接控制地图飞行动画的函数（主流地图的"缩小→移动→放大"效果）
  function flyToLocation(targetCenter, targetZoom = null) {
    const map = mapRef.current;
    if (!map) {
      console.warn('flyToLocation: Map not available');
      return;
    }

    const [targetLat, targetLon] = targetCenter;
    if (typeof targetLat !== 'number' || typeof targetLon !== 'number') {
      console.warn('flyToLocation: Invalid coordinates');
      return;
    }

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const finalZoom = targetZoom || currentZoom;

    // 计算距离
    let dist = 0;
    try {
      dist = map.distance([currentCenter.lat, currentCenter.lng], targetCenter);
    } catch (e) {
      dist = 100000;
    }

    if (dist < 100) {
      // 距离太近，不需要动画
      return;
    }

    if (dist > 30000) {
      // 远距离：先缩小，再移动并放大
      let zoomOut = 5;
      if (dist < 100000) zoomOut = 7;
      else if (dist < 300000) zoomOut = 6;
      else if (dist < 600000) zoomOut = 5;
      else zoomOut = 4;

      zoomOut = Math.min(zoomOut, currentZoom - 2);
      if (zoomOut < 3) zoomOut = 3;

      // Step 1: 缩小
      map.flyTo(currentCenter, zoomOut, {
        animate: true,
        duration: 0.5
      });

      // Step 2: 缩小完成后飞到新位置并放大
      map.once('zoomend', () => {
        map.flyTo(targetCenter, finalZoom, {
          animate: true,
          duration: 1.0
        });

        map.once('moveend', () => {
          try {
            if (markerRef.current) markerRef.current.openPopup();
          } catch (e) { }
        });
      });

    } else {
      // 短距离：直接飞过去
      let duration = 0.8;
      if (dist < 5000) duration = 0.5;
      else if (dist < 15000) duration = 0.6;

      map.flyTo(targetCenter, finalZoom, {
        animate: true,
        duration: duration
      });

      map.once('moveend', () => {
        try {
          if (markerRef.current) markerRef.current.openPopup();
        } catch (e) { }
      });
    }
  }

  // 点击地图触发
  function MapClickHandler() {
    const map = useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        console.log('Map clicked at lat/lon:', lat, lng);

        // 使用 flyToLocation 进行动画（会自动处理距离判断）
        flyToLocation([lat, lng]);

        setMapCenter([lat, lng]);

        // Then fetch weather for clicked point
        await fetchWeatherByLatLon(lat, lng);
      },
    });
    return null;
  }

  // Set view component to update map center when mapCenter changes
  function MapViewSetter({ center }) {
    const map = useMap();
    const isInitialMount = useRef(true);
    const prevCenterRef = useRef(null);
    const isAnimating = useRef(false);

    // 将坐标转换为字符串以便 React 正确检测变化
    const centerKey = center ? `${center[0]},${center[1]}` : '';

    useEffect(() => {
      console.log('MapViewSetter useEffect triggered, centerKey:', centerKey);

      if (!center || !map || center.length !== 2) {
        console.log('MapViewSetter: Invalid center or map', { center, hasMap: !!map });
        return;
      }

      const [currLat, currLon] = center;

      // 验证坐标有效性
      if (typeof currLat !== 'number' || typeof currLon !== 'number' ||
        isNaN(currLat) || isNaN(currLon)) {
        console.log('MapViewSetter: Invalid coordinates', { currLat, currLon });
        return;
      }

      // 跳过初始挂载
      if (isInitialMount.current) {
        console.log('MapViewSetter: Skipping initial mount');
        isInitialMount.current = false;
        prevCenterRef.current = center;
        return;
      }

      // 如果正在动画中，跳过
      if (isAnimating.current) {
        console.log('MapViewSetter: Animation in progress, skipping');
        return;
      }

      // 检查是否真的需要移动
      const prev = prevCenterRef.current;
      if (prev && prev[0] === currLat && prev[1] === currLon) {
        console.log('MapViewSetter: Same location, skipping');
        return;
      }

      // 计算距离
      let dist = 0;
      if (prev && prev.length === 2) {
        try {
          dist = map.distance(prev, center);
        } catch (e) {
          dist = 100000; // 如果计算失败，假设是远距离
        }
      } else {
        dist = 100000; // 没有前一个位置，假设是远距离
      }

      console.log('MapViewSetter: Distance calculated', { prev, center, dist });

      // 如果距离太小，不需要动画（降低到10米）
      if (dist < 10) {
        console.log('MapViewSetter: Distance too small, skipping animation');
        prevCenterRef.current = center;
        return;
      }

      console.log('MapViewSetter: Starting animation to', center, 'distance:', dist);

      isAnimating.current = true;
      prevCenterRef.current = center;
      const originalZoom = map.getZoom();

      // 主流地图的"缩小 → 移动 → 放大"动画
      if (dist > 30000) {
        // 远距离：先缩小，再移动并放大
        // 根据距离计算缩小程度
        let zoomOut = 5;
        if (dist < 100000) zoomOut = 7;
        else if (dist < 300000) zoomOut = 6;
        else if (dist < 600000) zoomOut = 5;
        else zoomOut = 4;

        // 确保缩小级别合理
        zoomOut = Math.min(zoomOut, originalZoom - 2);
        if (zoomOut < 3) zoomOut = 3;

        // Step 1: 缩小当前位置
        map.flyTo(map.getCenter(), zoomOut, {
          animate: true,
          duration: 0.5
        });

        // Step 2: 缩小完成后，飞到新位置并放大
        const handleZoomEnd = () => {
          map.off('zoomend', handleZoomEnd);

          map.flyTo(center, originalZoom, {
            animate: true,
            duration: 1.0
          });

          // 动画完成后打开弹窗
          const handleMoveEnd = () => {
            map.off('moveend', handleMoveEnd);
            isAnimating.current = false;
            try {
              if (markerRef.current) markerRef.current.openPopup();
            } catch (e) { }
          };
          map.once('moveend', handleMoveEnd);
        };
        map.once('zoomend', handleZoomEnd);

      } else {
        // 短距离：直接平滑移动
        let duration = 0.8;
        if (dist < 5000) duration = 0.5;
        else if (dist < 15000) duration = 0.6;

        map.flyTo(center, originalZoom, {
          animate: true,
          duration: duration
        });

        // 动画完成后打开弹窗
        const handleMoveEnd = () => {
          map.off('moveend', handleMoveEnd);
          isAnimating.current = false;
          try {
            if (markerRef.current) markerRef.current.openPopup();
          } catch (e) { }
        };
        map.once('moveend', handleMoveEnd);
      }

    }, [centerKey, map]); // 使用 centerKey 字符串作为依赖项

    return null;
  }

  // 改进的热力图组件 - 使用 Canvas 绘制连续颜色场（类似雷达图效果）
  function HeatmapLayer({ data, visible }) {
    const map = useMap();
    const layerRef = useRef(null);
    const canvasRef = useRef(null);
    const dataRef = useRef(null); // 用于存储数据

    useEffect(() => {
      if (!map || !visible) {
        if (layerRef.current) {
          try {
            map.removeLayer(layerRef.current);
          } catch (e) { }
          layerRef.current = null;
        }
        if (canvasRef.current && canvasRef.current.parentNode) {
          canvasRef.current.parentNode.removeChild(canvasRef.current);
        }
        return;
      }

      const validData = data.filter(w =>
        w.status === 'done' &&
        w.main?.temp !== undefined &&
        !isNaN(w.main.temp)
      );

      if (validData.length === 0) {
        // 如果没有数据，清理图层
        if (layerRef.current) {
          try {
            map.removeLayer(layerRef.current);
          } catch (e) { }
          layerRef.current = null;
        }
        return;
      }

      // 存储数据到 ref，以便在 drawHeatmap 中访问
      dataRef.current = validData;

      // 反距离加权插值
      function idwInterpolation(lat, lon, points, power = 2) {
        let numerator = 0;
        let denominator = 0;

        for (const point of points) {
          const [px, py, value] = point;
          const distance = Math.sqrt(Math.pow(lat - px, 2) + Math.pow(lon - py, 2));

          if (distance < 0.0001) return value;

          const weight = 1 / Math.pow(distance, power);
          numerator += weight * value;
          denominator += weight;
        }

        return denominator > 0 ? numerator / denominator : null;
      }

      // 温度转颜色（RGB值）
      function tempToRGB(temp, minTemp, maxTemp) {
        if (temp === null) return [0, 0, 0, 0];
        const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp || 1)));

        let r, g, b;
        if (normalized < 0.2) {
          // 蓝色 (冷)
          const t = normalized / 0.2;
          r = 0;
          g = Math.floor(100 + t * 155);
          b = Math.floor(200 + t * 55);
        } else if (normalized < 0.4) {
          // 青色到绿色
          const t = (normalized - 0.2) / 0.2;
          r = Math.floor(t * 50);
          g = Math.floor(255 - t * 100);
          b = Math.floor(255 - t * 200);
        } else if (normalized < 0.6) {
          // 绿色到黄色
          const t = (normalized - 0.4) / 0.2;
          r = Math.floor(50 + t * 205);
          g = 255;
          b = Math.floor(55 - t * 55);
        } else if (normalized < 0.8) {
          // 黄色到橙色
          const t = (normalized - 0.6) / 0.2;
          r = 255;
          g = Math.floor(255 - t * 100);
          b = 0;
        } else {
          // 橙色到红色 (热)
          const t = (normalized - 0.8) / 0.2;
          r = 255;
          g = Math.floor(155 - t * 155);
          b = 0;
        }

        return [r, g, b, 0.7]; // 增加透明度让效果更明显
      }

      // 绘制函数
      function drawHeatmap() {
        if (!canvasRef.current || !map || !dataRef.current || dataRef.current.length === 0) {
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const container = map.getContainer();

        if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
          return;
        }

        // 设置画布尺寸
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bounds = map.getBounds();
        const points = dataRef.current.map(w => [w.lat, w.lon, w.main.temp]);
        const temps = points.map(p => p[2]);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);

        if (minTemp === maxTemp) {
          // 如果所有温度相同，使用单一颜色
          const [r, g, b, a] = tempToRGB(minTemp, minTemp, minTemp + 1);
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

        // 根据缩放级别调整网格密度
        const zoom = map.getZoom();
        const gridSize = Math.max(50, Math.min(120, 150 - zoom * 5));

        const stepLat = (bounds.getNorth() - bounds.getSouth()) / gridSize;
        const stepLon = (bounds.getEast() - bounds.getWest()) / gridSize;

        // 创建图像数据
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const dataArray = imageData.data;

        // 生成网格并插值
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const lat = bounds.getSouth() + i * stepLat;
            const lon = bounds.getWest() + j * stepLon;
            const temp = idwInterpolation(lat, lon, points, 2);

            if (temp === null) continue;

            // 转换为像素坐标
            const point = map.latLngToContainerPoint([lat, lon]);
            const x = Math.floor(point.x);
            const y = Math.floor(point.y);

            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

            // 获取颜色
            const [r, g, b, a] = tempToRGB(temp, minTemp, maxTemp);
            const alpha = Math.floor(a * 255);

            // 绘制一个区域（让颜色更连续）
            const radius = 6; // 增加半径让效果更明显
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dy = -radius; dy <= radius; dy++) {
                const px = x + dx;
                const py = y + dy;

                if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) continue;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;

                // 距离衰减
                const fade = 1 - (dist / radius);
                const finalAlpha = Math.floor(alpha * fade);

                const idx = (py * canvas.width + px) * 4;

                // Alpha 混合
                const existingA = dataArray[idx + 3];
                if (existingA === 0) {
                  dataArray[idx] = r;
                  dataArray[idx + 1] = g;
                  dataArray[idx + 2] = b;
                  dataArray[idx + 3] = finalAlpha;
                } else {
                  const newAlpha = finalAlpha / 255;
                  const oldAlpha = existingA / 255 * (1 - newAlpha);
                  const combinedAlpha = newAlpha + oldAlpha;

                  dataArray[idx] = (r * newAlpha + dataArray[idx] * oldAlpha) / combinedAlpha;
                  dataArray[idx + 1] = (g * newAlpha + dataArray[idx + 1] * oldAlpha) / combinedAlpha;
                  dataArray[idx + 2] = (b * newAlpha + dataArray[idx + 2] * oldAlpha) / combinedAlpha;
                  dataArray[idx + 3] = combinedAlpha * 255;
                }
              }
            }
          }
        }

        // 应用图像数据
        ctx.putImageData(imageData, 0, 0);

        // 应用模糊效果让过渡更平滑（类似雷达图）
        if (ctx.filter !== undefined) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, 0);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'blur(15px)';
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.filter = 'none';
        }
      }

      // 创建 Canvas 元素
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '600';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvasRef.current = canvas;

        // 创建自定义图层
        const CanvasLayer = L.Layer.extend({
          onAdd: function (map) {
            this._map = map;
            const pane = map.getPane('overlayPane');
            if (pane) {
              pane.appendChild(canvas);
            }
            // 延迟一下确保地图已完全初始化
            setTimeout(() => {
              this._update();
            }, 100);
            map.on('moveend', this._update, this);
            map.on('zoomend', this._update, this);
            map.on('resize', this._update, this);
          },
          onRemove: function (map) {
            const pane = map.getPane('overlayPane');
            if (pane && canvas.parentNode === pane) {
              pane.removeChild(canvas);
            }
            map.off('moveend', this._update, this);
            map.off('zoomend', this._update, this);
            map.off('resize', this._update, this);
          },
          _update: function () {
            if (!this._map) return;
            const container = this._map.getContainer();
            if (!container) return;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            drawHeatmap();
          }
        });

        layerRef.current = new CanvasLayer();
        layerRef.current.addTo(map);
      } else {
        // 如果 Canvas 已存在，直接更新
        setTimeout(() => drawHeatmap(), 100);
      }

      // 监听地图变化
      const updateHandler = () => {
        setTimeout(() => drawHeatmap(), 100);
      };

      map.on('moveend', updateHandler);
      map.on('zoomend', updateHandler);

      return () => {
        map.off('moveend', updateHandler);
        map.off('zoomend', updateHandler);
        if (layerRef.current) {
          try {
            map.removeLayer(layerRef.current);
          } catch (e) {
            console.warn('Heatmap cleanup error', e);
          }
          layerRef.current = null;
        }
        if (canvasRef.current && canvasRef.current.parentNode) {
          canvasRef.current.parentNode.removeChild(canvasRef.current);
        }
      };
    }, [map, data, visible]);

    return null;
  }

  // Radar Layer Component - 直接操作 Leaflet 图层避免闪烁
  function RadarLayer({ tileUrl, visible, opacity = 0.7 }) {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
      if (!map) return;

      // 如果不可见，移除图层
      if (!visible || !tileUrl) {
        if (layerRef.current) {
          try {
            map.removeLayer(layerRef.current);
          } catch (e) {
            console.warn('Radar layer cleanup error', e);
          }
          layerRef.current = null;
        }
        return;
      }

      // 如果图层已存在，只更新 URL 和 opacity，不重新创建
      if (layerRef.current) {
        try {
          layerRef.current.setUrl(tileUrl);
          layerRef.current.setOpacity(opacity);
          // 强制刷新图层
          layerRef.current.redraw();
        } catch (e) {
          console.warn('Radar layer update error', e);
          // 如果更新失败，重新创建
          try {
            map.removeLayer(layerRef.current);
          } catch (e2) { }
          layerRef.current = null;
        }
      }

      // 如果图层不存在，创建新图层
      if (!layerRef.current) {
        try {
          const layer = L.tileLayer(tileUrl, {
            opacity: opacity,
            zIndex: 650,
            attribution: '&copy; <a href="https://www.rainviewer.com">RainViewer</a>',
            // 添加跨域和缓存控制
            crossOrigin: true,
            maxZoom: 18,
            tileSize: 256,
            zoomOffset: 0
          });
          layer.addTo(map);
          layerRef.current = layer;
        } catch (e) {
          console.warn('Radar layer creation error', e);
        }
      }

      return () => {
        // 清理函数：只在组件卸载时移除图层
        if (layerRef.current) {
          try {
            map.removeLayer(layerRef.current);
          } catch (e) {
            console.warn('Radar layer cleanup error', e);
          }
          layerRef.current = null;
        }
      };
    }, [map, tileUrl, visible, opacity]);

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

        // 使用 flyToLocation 进行动画
        flyToLocation([latitude, longitude]);

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

              // 使用 flyToLocation 进行动画
              flyToLocation([lat, lon]);

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
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true&hourly=relativehumidity_2m,temperature_2m,precipitation_probability,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const omr = await fetch(openMeteoUrl);
        if (omr.ok) {
          const omData = await omr.json();
          const current = omData?.current_weather ?? {};

          // 调试信息：查看实际返回的数据
          console.log('Open-Meteo current_weather:', {
            weathercode: current?.weathercode,
            time: current?.time,
            temperature: current?.temperature
          });

          let humidity = null;
          let rainProb = null;
          let hourlyCode = null;

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
            // 获取当前小时的 weathercode（可能更准确）
            if (omData.hourly.weathercode) {
              hourlyCode = omData.hourly.weathercode[idx];
            }
          }

          // 优先使用 hourly 的 weathercode，因为它可能更实时
          // 如果 hourly 没有，则使用 current_weather 的
          let code = hourlyCode ?? current?.weathercode ?? null;

          // 调试信息：查看最终使用的代码
          console.log('Weather code decision:', {
            currentCode: current?.weathercode,
            hourlyCode: hourlyCode,
            finalCode: code,
            rainProb: rainProb,
            description: OM_WEATHER_CODE_DESCRIPTION[code]
          });

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
        let targetCity = knownCityName;
        // If we don't have a known city name, try to reverse geocode
        if (!targetCity) {
          targetCity = await reverseGeocode(lat, lon);
        }

        // If still no city name, and we want to use backend, we might fail or try a fallback.
        // But since the direct lat/lon endpoint /weather/current?lat=... is unreliable, 
        // we skip backend if we can't find a name.
        if (!targetCity) return null;

        // Use the city name endpoint
        const res = await fetch(`https://backend1212.onrender.com/weather/${encodeURIComponent(targetCity)}`);

        if (res.ok) {
          const json = await res.json();
          const d = json?.data ?? json?.result ?? json;

          let city = d?.city ?? d?.name ?? d?.location?.name ?? 'Unknown';
          let weatherArray = d?.weather ?? d?.weatherArray ?? [];
          let main = d?.main ?? d?.current ?? {};

          if (d?.current) {
            weatherArray = [{ description: d.current?.condition?.text ?? d.current?.weather_descriptions?.[0] }].filter(Boolean);
            const _windSpeed = d.current?.wind_kph ?? d.current?.wind?.speed ?? d.wind?.speed ?? d.wind_speed ?? d.current?.windspeed ?? null;
            const _windDir = d.current?.wind_degree ?? d.current?.wind_deg ?? d.current?.wind_dir ?? d.current?.winddir ?? d.wind?.deg ?? d.winddirection ?? null;
            main = { temp: d.current?.temp_c ?? d.current?.temp, humidity: d.current?.humidity, windSpeed: _windSpeed, windDirection: _windDir };
            city = city === 'Unknown' ? (d.location?.name ?? 'Unknown') : city;
          } else {
            // Handle OpenWeatherMap style response if proxied directly
            // d.name is usually the station name, d.city (from our backend wrapper) might be the requested city
            if (d.city && d.city !== 'current') city = d.city;
            else if (d.name) city = d.name;
          }

          if (knownCityName) city = knownCityName;

          // Ensure we have weather data
          if (!main.temp && main.temp !== 0 && !weatherArray.length) {
            console.warn('Backend response missing weather data', d);
            return null;
          }

          return { city, weatherArray, main, lat, lon, raw: d, source: 'backend' };
        }
      } catch (err) {
        console.warn('Backend request failed', err);
      }
      return null;
    }

    // Helper to sanitize city name (remove duplicates like "Tokyo, Tokyo")
    function sanitizeCityName(name) {
      if (!name) return name;
      // Allow comma or space as separator
      const parts = name.split(/[,，\s]+/);
      const unique = [];
      const seen = new Set();
      for (const p of parts) {
        const cleanP = p.trim();
        if (cleanP && !seen.has(cleanP)) {
          seen.add(cleanP);
          unique.push(cleanP);
        }
      }
      // If original had commas, join with commas. If spaces, spaces.
      // Default to known style or just return original if no dupe found?
      if (unique.length === parts.length) return name;

      return unique.join(name.includes(',') ? ', ' : ' ');
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

      if (result) {
        result.city = sanitizeCityName(result.city);
        return result;
      }

      // No provider succeeded
      return { city: sanitizeCityName(knownCityName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`), weatherArray: [], main: {}, lat, lon, raw: {}, source: 'none' };
    } catch (e) {
      console.error('getWeatherData failed', e);
      return { city: sanitizeCityName(knownCityName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`), weatherArray: [], main: {}, lat, lon, raw: { error: String(e) }, source: 'error' };
    }
  }

  // 优化 fetchAllWards，批量更新状态而不是逐个更新
  async function fetchAllWards() {
    const wardList = WARDS_23;
    // 初始化列表
    setWardWeatherList(wardList.map(w => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      lon: w.lon,
      status: 'idle',
      weatherArray: [],
      main: {},
      raw: null,
      source: null
    })));

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
    const updates = []; // 收集所有更新

    // 使用批量更新，减少重新渲染次数
    for (const w of wardList) {
      const cached = cache?.[w.id];
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
        updates.push({ id: w.id, data: { ...cached.data, status: 'done' } });
        continue;
      }

      updates.push({ id: w.id, data: { status: 'loading' } });

      try {
        await new Promise(r => setTimeout(r, 200));
        const r = await getWeatherData(w.lat, w.lon, w.name);
        const entry = { ...r, id: w.id, name: w.name };
        updates.push({ id: w.id, data: { ...entry, status: 'done' } });
        cache[w.id] = { ts: Date.now(), data: entry };
        saveCache(cache);
      } catch (e) {
        updates.push({ id: w.id, data: { status: 'error', raw: { error: String(e) } } });
      }

      // 每5个更新批量应用一次，而不是每个都更新
      if (updates.length >= 5) {
        setWardWeatherList(prev => {
          const next = [...prev];
          updates.forEach(update => {
            const idx = next.findIndex(p => p.id === update.id);
            if (idx !== -1) {
              next[idx] = { ...next[idx], ...update.data };
            }
          });
          return next;
        });
        updates.length = 0; // 清空数组
      }
    }

    // 应用剩余的更新
    if (updates.length > 0) {
      setWardWeatherList(prev => {
        const next = [...prev];
        updates.forEach(update => {
          const idx = next.findIndex(p => p.id === update.id);
          if (idx !== -1) {
            next[idx] = { ...next[idx], ...update.data };
          }
        });
        return next;
      });
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

      // 优化 popup 打开时机，使用 requestAnimationFrame 避免布局抖动
      /*
      // Removed auto-open popup here to prevent conflict with flyTo animation.
      // Popup will be handled by MapViewSetter's moveend event or manual interaction.
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            if (markerRef.current) {
              markerRef.current.openPopup();
            }
          } catch (e) {
            console.warn('Auto-open popup error', e);
          }
        }, 100); // 稍微延迟，确保 DOM 已更新
      });
      */

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

          // 直接调用地图动画，不依赖 state 变化
          flyToLocation([latNum, lonNum]);

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
        {/* Modern Header */}
        <div className="sidebar-header-modern">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-icon-wrapper">
              <CloudSun size={22} color="#2563eb" />
            </div>
            <div>
              <h1 className="sidebar-title-modern">
                {t('title')}
              </h1>
              <div className="sidebar-subtitle">東京の天気情報</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
            title={t('close')}
          >
            <span>×</span>
          </button>
        </div>

        {/* Search Box - Modern Design */}
        <div className="search-box-modern">
          <Search className="search-icon-modern" size={18} />
          <input
            className="search-input-modern"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

        {/* Current Location Card - Modern */}
        <div className="card-modern">
          <div className="card-header">
            <MapPin size={16} color="#64748b" />
            <span className="card-title">現在地</span>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="status-loading">
                <div className="spinner-small" />
                <span>{t('loading')}</span>
              </div>
            ) : error ? (
              <div className="status-error">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            ) : weather ? (
              <div className="location-info">
                <div className="location-name">{weather.city}</div>
                {weather.main?.temp !== undefined && (
                  <div className="location-temp">{Math.round(weather.main.temp)}°C</div>
                )}
              </div>
            ) : (
              <div className="status-placeholder">{t('clickToShow')}</div>
            )}
          </div>
          <button className="btn-modern-primary" onClick={handleLocateMe}>
            <Navigation size={16} />
            <span>{t('locate')}</span>
          </button>
        </div>

        {/* Data Source - Modern Toggle */}
        <div className="card-modern">
          <div className="card-header">
            <Database size={16} color="#64748b" />
            <span className="card-title">{t('dataSource')}</span>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${dataSourcePreference === 'open-meteo-first' ? 'active' : ''}`}
              onClick={() => { setDataSourcePreference('open-meteo-first'); localStorage.setItem('weatherSourcePref', 'open-meteo-first'); fetchAllWards(); }}
            >
              Open-Meteo
            </button>
            <button
              className={`toggle-btn ${dataSourcePreference === 'backend-first' ? 'active' : ''}`}
              onClick={() => { setDataSourcePreference('backend-first'); localStorage.setItem('weatherSourcePref', 'backend-first'); fetchAllWards(); }}
            >
              <Server size={14} />
              {t('backend')}
            </button>
          </div>
        </div>

        {/* Display Mode - Modern Toggle */}
        <div className="card-modern">
          <div className="card-header">
            <LayoutTemplate size={16} color="#64748b" />
            <span className="card-title">{t('displayContentLabel')}</span>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${displayMode === 'summary' ? 'active' : ''}`}
              onClick={() => { setDisplayMode('summary'); localStorage.setItem('weatherDisplayMode', 'summary'); }}
            >
              概要
            </button>
            <button
              className={`toggle-btn ${displayMode === 'detail' ? 'active' : ''}`}
              onClick={() => { setDisplayMode('detail'); localStorage.setItem('weatherDisplayMode', 'detail'); }}
            >
              詳細
            </button>
          </div>
        </div>

        {/* Map Layers - Modern Design */}
        <div className="card-modern">
          <div className="card-header">
            <Monitor size={16} color="#64748b" />
            <span className="card-title">{t('mapLayers')}</span>
          </div>
          <div className="layer-controls">
            <button
              className={`layer-btn ${showRadar ? 'active' : ''}`}
              onClick={() => setShowRadar(!showRadar)}
            >
              <Umbrella size={18} />
              <span>{t('radar')}</span>
            </button>
            <button
              className={`layer-btn ${showHeatmap ? 'active' : ''}`}
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <Thermometer size={18} />
              <span>{t('heatmap')}</span>
            </button>
            <button
              className={`layer-btn ${is3DMode ? 'active' : ''}`}
              onClick={() => setIs3DMode(!is3DMode)}
            >
              <MapPin size={18} />
              <span>{t('satellite')}</span>
            </button>
          </div>

          {/* Radar Controls - Enhanced */}
          {showRadar && radarTimestamps.length > 0 && (
            <div className="radar-controls-modern">
              <div className="radar-controls-header">
                <div className="radar-time-display">
                  {radarTimestamps[radarIndex] && (
                    <>
                      {new Date(radarTimestamps[radarIndex].time * 1000).toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      <span className="radar-frame-count">({radarIndex + 1}/{radarTimestamps.length})</span>
                    </>
                  )}
                </div>
              </div>
              <div className="radar-controls-actions">
                <button
                  className="radar-btn-small"
                  onClick={() => setIsRadarPlaying(!isRadarPlaying)}
                >
                  {isRadarPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  className="radar-btn-small"
                  onClick={() => {
                    setIsRadarPlaying(false);
                    setRadarIndex(0);
                  }}
                  title="最初に戻る"
                >
                  ↺
                </button>
                <select
                  value={radarPlaySpeed}
                  onChange={(e) => setRadarPlaySpeed(Number(e.target.value))}
                  className="radar-speed-select"
                >
                  <option value={500}>0.5秒</option>
                  <option value={1000}>1秒</option>
                  <option value={2000}>2秒</option>
                  <option value={3000}>3秒</option>
                </select>
              </div>
              <div className="radar-progress-modern">
                {radarTimestamps.map((_, i) => (
                  <div
                    key={i}
                    className={`radar-progress-dot ${i === radarIndex ? 'current' : i < radarIndex ? 'played' : ''
                      }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Heatmap Legend - Modern */}
        {showHeatmap && (
          <div className="card-modern">
            <div className="card-header">
              <Thermometer size={16} color="#64748b" />
              <span className="card-title">{t('heatmapLegend')}</span>
            </div>
            <div className="heatmap-legend-modern">
              <div className="heatmap-gradient" />
              <div className="heatmap-labels">
                <span>0°C</span>
                <span>10°</span>
                <span>20°</span>
                <span>30°</span>
                <span>40°C</span>
              </div>
            </div>
          </div>
        )}

        {/* 23 Wards Progress - Modern */}
        <div className="card-modern">
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color="#64748b" />
                <span className="card-title">23区の読み込み</span>
              </div>
              <span className="progress-count">
                {wardWeatherList.filter(w => w.status === 'done').length} / {wardWeatherList.length || 23}
              </span>
            </div>
          </div>
          <div className="progress-bar-modern">
            <div
              className="progress-bar-fill"
              style={{
                width: `${(wardWeatherList.filter(w => w.status === 'done').length / 23) * 100}%`
              }}
            />
          </div>
          <div className="card-actions">
            <button className="btn-modern-secondary" onClick={async () => { localStorage.removeItem('wardsWeatherCache'); fetchAllWards(); }}>
              {t('clearCache')}
            </button>
            <button className="btn-modern-secondary" onClick={() => fetchAllWards()}>
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
          <MapRefSetter />
          <MapClickHandler />
          <HeatmapLayer data={wardWeatherList} visible={showHeatmap} />

          {/* Base Layer: Switch between Light and Satellite */}
          <TileLayer
            key={is3DMode ? 'satellite' : 'light'}
            url={is3DMode
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://tile.openstreetmap.jp/{z}/{x}/{y}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://www.openstreetmap.jp/">OpenStreetMap Japan</a>'
            subdomains={[]}
          />

          {/* Radar Layer - 使用自定义组件避免闪烁 */}
          <RadarLayer
            tileUrl={radarTile}
            visible={showRadar}
            opacity={0.7}
          />

          {/* Banner Alert (this was incorrectly placed under Radar Layer comment) */}
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
