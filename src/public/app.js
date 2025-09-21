const { h, render } = preact;
const { useState, useEffect, useMemo, useRef } = preactHooks;
const html = htm.bind(h);

function initParticles() {
  particlesJS('particles-js', {
    particles: {
      number: { value: 70, density: { enable: true, value_area: 900 } },
      color: { value: '#ccccff' },
      shape: { type: 'circle' },
      opacity: { value: 0.5, random: true },
      size: { value: 2.4, random: true },
      line_linked: { enable: false },
      move: {
        enable: true,
        speed: 0.6,
        direction: 'none',
        random: true,
        straight: false,
        out_mode: 'out',
        attract: { enable: false },
      },
    },
    interactivity: {
      detect_on: 'canvas',
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true },
    },
    retina_detect: true,
  });
}

function getParticlesInstance() {
  if (window.pJSDom && window.pJSDom.length) {
    return window.pJSDom[0].pJS;
  }
  return null;
}

function resetParticleVelocities(instance) {
  if (!instance) return;
  instance.particles.array.forEach((particle) => {
    particle.vx = particle.vx_i;
    particle.vy = particle.vy_i;
  });
}

function toggleBlackholeEffect(enabled) {
  const instance = getParticlesInstance();
  if (!instance) return;

  if (enabled) {
    if (instance._blackholeActive) return;
    instance._blackholeActive = true;
    instance._originalUpdate = instance.fn.particlesUpdate;

    instance.fn.particlesUpdate = function blackholeUpdate() {
      const button = document.getElementById('build-report-btn');
      const canvasEl = instance.canvas.el;
      if (!button || !canvasEl) {
        instance._originalUpdate();
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const canvasRect = canvasEl.getBoundingClientRect();
      const scaleX = canvasEl.width / canvasRect.width;
      const scaleY = canvasEl.height / canvasRect.height;
      const targetX = (buttonRect.left + buttonRect.width / 2 - canvasRect.left) * scaleX;
      const targetY = (buttonRect.top + buttonRect.height / 2 - canvasRect.top) * scaleY;
      const threshold =
        Math.max(buttonRect.width, buttonRect.height) * 0.4 * Math.max(scaleX, scaleY);

      const particles = instance.particles.array;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const normX = dx / dist;
        const normY = dy / dist;
        const speed = Math.min(8, Math.max(1.4, dist / 40));
        p.vx = normX * speed;
        p.vy = normY * speed;
      }

      instance._originalUpdate();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
          p.x = Math.random() * instance.canvas.w;
          p.y = Math.random() * instance.canvas.h;
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = (Math.random() - 0.5) * 0.5;
        }
      }
    };
  } else {
    if (!instance._blackholeActive) return;
    if (instance._originalUpdate) {
      instance.fn.particlesUpdate = instance._originalUpdate;
    }
    instance._blackholeActive = false;
    instance._originalUpdate = null;
    resetParticleVelocities(instance);
  }
}

async function postReport(payload) {
  const response = await fetch('/collect/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateIso(date) {
  return date.toISOString().split('T')[0];
}

function clampToYesterday(dateIso) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = formatDateIso(yesterday);
  return dateIso > yesterdayIso ? yesterdayIso : dateIso;
}

function App() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = formatDateIso(yesterday);

  const defaultEnd = new Date(yesterday);
  const defaultStart = new Date(yesterday);
  defaultStart.setDate(defaultEnd.getDate() - 30);

  const [nightscoutUrl, setNightscoutUrl] = useState('');
  const [startDate, setStartDate] = useState(formatDateIso(defaultStart));
  const [endDate, setEndDate] = useState(formatDateIso(defaultEnd));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  useEffect(() => {
    initParticles();
  }, []);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const savedUrl = localStorage.getItem('nightflux:url');
    const savedStart = localStorage.getItem('nightflux:start');
    const savedEnd = localStorage.getItem('nightflux:end');
    if (savedUrl) setNightscoutUrl(savedUrl);
    if (savedStart) setStartDate(clampToYesterday(savedStart));
    if (savedEnd) setEndDate(clampToYesterday(savedEnd));
  }, []);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (nightscoutUrl) {
      localStorage.setItem('nightflux:url', nightscoutUrl);
    } else {
      localStorage.removeItem('nightflux:url');
    }
  }, [nightscoutUrl]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('nightflux:start', startDate);
  }, [startDate]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('nightflux:end', endDate);
  }, [endDate]);

  useEffect(() => {
    if (!startInputRef.current || !endInputRef.current) return;
    startPickerRef.current = flatpickr(startInputRef.current, {
      altInput: true,
      altFormat: 'F j, Y',
      dateFormat: 'Y-m-d',
      defaultDate: startDate,
      maxDate: endDate,
      onChange: (_selectedDates, dateStr) => {
        setStartDate(dateStr);
      },
    });

    endPickerRef.current = flatpickr(endInputRef.current, {
      altInput: true,
      altFormat: 'F j, Y',
      dateFormat: 'Y-m-d',
      defaultDate: endDate,
      minDate: startDate,
      maxDate: yesterdayIso,
      onChange: (_selectedDates, dateStr) => {
        setEndDate(dateStr);
      },
    });

    return () => {
      if (startPickerRef.current) {
        startPickerRef.current.destroy();
        startPickerRef.current = null;
      }
      if (endPickerRef.current) {
        endPickerRef.current.destroy();
        endPickerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (startPickerRef.current) {
      startPickerRef.current.setDate(startDate, false);
      startPickerRef.current.set('maxDate', endDate || null);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (endPickerRef.current) {
      endPickerRef.current.setDate(endDate, false);
      endPickerRef.current.set('minDate', startDate || null);
      endPickerRef.current.set('maxDate', yesterdayIso);
    }
  }, [endDate, startDate, yesterdayIso]);

  const isValidUrl = useMemo(() => {
    if (!nightscoutUrl) return false;
    try {
      const parsed = new URL(nightscoutUrl);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (_err) {
      return false;
    }
  }, [nightscoutUrl]);

  const urlError = useMemo(() => {
    if (!nightscoutUrl)
      return 'Enter your full Nightscout URL, including a token with read permissions.';
    if (!isValidUrl) return 'Please enter a valid URL (starting with http:// or https://).';
    return '';
  }, [nightscoutUrl, isValidUrl]);

  const isDateRangeValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate && endDate <= yesterdayIso;
  }, [startDate, endDate, yesterdayIso]);

  const isFormValid = isValidUrl && isDateRangeValid && !isLoading;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!isFormValid) return;

    const payload = {
      url: nightscoutUrl,
      start: startDate,
      end: endDate,
    };

    try {
      setIsLoading(true);
      toggleBlackholeEffect(true);
      const responseText = await postReport(payload);
      const filename = `ns-report-${startDate}-${endDate}.yaml`;
      downloadTextFile(responseText, filename);
    } catch (err) {
      console.error(err);
      setError('Something went wrong while building your report. Please try again.');
    } finally {
      setIsLoading(false);
      toggleBlackholeEffect(false);
    }
  }

  return html`
    <div>
      <form onSubmit=${handleSubmit}>
        <div class="field-group">
          <label for="nightscout-url">Nightscout URL</label>
          <input
            id="nightscout-url"
            type="url"
            required
            placeholder="https://my-nightscout-site.com?token=abc123"
            value=${nightscoutUrl}
            disabled=${isLoading}
            onInput=${(event) => setNightscoutUrl(event.target.value.trim())}
          />
          <p class=${urlError && !isValidUrl ? 'error-text' : 'helper-text'}>${urlError}</p>
        </div>

        <div class="field-group">
          <label>Range</label>
          <div class="range-grid">
            <input
              ref=${startInputRef}
              id="start-date"
              type="text"
              required
              disabled=${isLoading}
              aria-label="Start date"
            />
            <input
              ref=${endInputRef}
              id="end-date"
              type="text"
              required
              disabled=${isLoading}
              aria-label="End date"
            />
          </div>
          ${!isDateRangeValid && html`<p class="error-text">Start date must be on or before the end date, and the end date cannot be later than yesterday.</p>`}
          ${isDateRangeValid && html`<p class="helper-text">Select a date range for the report.</p>`}
        </div>

        <div class="button-row">
          <button id="build-report-btn" class="primary" type="submit" disabled=${!isFormValid}>
            ${isLoading ? 'Collecting data...' : 'Build Report'}
          </button>
          ${error && html`<p class="error-text">${error}</p>`}
        </div>
      </form>

      <hr />

      <section class="info-section">
        <h2>How do I use this?</h2>
        <p>
          Nightflux produces an AI-optimized report of your Nightscout history. 
          

          </p><p>
          Upload the
          report to ChatGPT and ask it to "follow the instructions in the file".
        <p>
        From there, you can ask it questions about your data, like:
        </p>
        <ul>
          <li>"Summarize my last 30 days."</li>
          <li>"Create an AGP chart."</li>
          <li>"Help me find patterns in my data."</li>
        </ul>
     
        </p>
        
      </section>
<p class="tip">
          Your data is removed immediately after the report is created. Prefer to keep everything local? You can${' '}
          <a href="https://github.com/nielsmaerten/nightflux-core">generate</a> the same report from the command line.
        </p>
      <p class="tip">Tip: Your URL is remembered locally on this device.</p>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
