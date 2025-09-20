function formatDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function downloadYaml(yamlText) {
  const blob = new Blob([yamlText], { type: 'text/yaml' });
  const downloadLink = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadLink.download = `nightflux-report-${timestamp}.yaml`;
  downloadLink.href = URL.createObjectURL(blob);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadLink.href);
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url');
  const startInput = document.getElementById('date-start');
  const endInput = document.getElementById('date-end');
  const form = document.getElementById('nf-form');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('submit');

  const baseParticleSpeed = 1.0;
  const applyParticleSpeed = (multiplier) => {
    const context = window.pJSDom && window.pJSDom[0];
    if (context && context.pJS && context.pJS.particles && context.pJS.particles.move) {
      context.pJS.particles.move.speed = baseParticleSpeed * multiplier;
      context.pJS.particles.line_linked.enable = multiplier > 1;
    }
  };

  const moveParticlesToCenter = () => {
    const context = window.pJSDom && window.pJSDom[0];
    if (!context || !context.pJS) return;
    const pJS = context.pJS;

    pJS.particles.line_linked.enable = true;
    pJS.particles.move.out_mode = 'bounce';

    if (context.__centerSteerRaf) cancelAnimationFrame(context.__centerSteerRaf);

    const respawnAtEdge = (particle) => {
      const radius = particle.radius || 2;
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) {
        particle.x = Math.random() * pJS.canvas.w;
        particle.y = radius + 1;
      } else if (edge === 1) {
        particle.x = Math.random() * pJS.canvas.w;
        particle.y = pJS.canvas.h - radius - 1;
      } else if (edge === 2) {
        particle.x = radius + 1;
        particle.y = Math.random() * pJS.canvas.h;
      } else {
        particle.x = pJS.canvas.w - radius - 1;
        particle.y = Math.random() * pJS.canvas.h;
      }
      particle.vx = 0;
      particle.vy = 0;
    };

    const steer = () => {
      const centerX = pJS.canvas.w / 2;
      const centerY = pJS.canvas.h / 2;

      for (const particle of pJS.particles.array) {
        const deltaX = centerX - particle.x;
        const deltaY = centerY - particle.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;

        if (distance < 8) {
          respawnAtEdge(particle);
          continue;
        }

        const speedScale = Math.min(4, 0.6 + distance / 120);
        const speed = baseParticleSpeed * speedScale;
        particle.vx = (deltaX / distance) * speed;
        particle.vy = (deltaY / distance) * speed;
      }

      context.__centerSteerRaf = requestAnimationFrame(steer);
    };

    steer();
  };

  if (window.particlesJS) {
    window.particlesJS('particles-js', {
      particles: {
        number: { value: 20, density: { enable: true, value_area: 800 } },
        color: { value: '#9aa0a6' },
        shape: { type: 'circle' },
        opacity: { value: 0.35, random: false },
        size: { value: 4, random: true },
        line_linked: { enable: false, distance: 150, color: '#6b7280', opacity: 0.25, width: 1 },
        move: { enable: true, speed: baseParticleSpeed, direction: 'none', out_mode: 'out' },
      },
      interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: false }, onclick: { enable: false }, resize: true },
      },
      retina_detect: true,
    });
  }

  const params = new URLSearchParams(location.search);
  const savedUrl = localStorage.getItem('nightflux.url') || '';
  urlInput.value = params.get('url') || savedUrl;
  urlInput.addEventListener('change', () =>
    localStorage.setItem('nightflux.url', urlInput.value.trim()),
  );

  const end = params.get('end')
    ? new Date(params.get('end'))
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date;
      })();
  const start = params.get('start') ? new Date(params.get('start')) : new Date(end);
  if (!params.get('start')) start.setDate(end.getDate() - 30);

  startInput.value = formatDate(start);
  endInput.value = formatDate(end);

  const syncDateConstraints = () => {
    const startValue = startInput.value;
    const endValue = endInput.value;
    endInput.min = startValue || '';
    startInput.max = endValue || '';
  };

  const enforceRangeOrder = (changedInput) => {
    const startValue = startInput.value;
    const endValue = endInput.value;
    if (!startValue || !endValue) return;
    if (startValue <= endValue) return;

    if (changedInput === startInput) {
      endInput.value = startValue;
    } else {
      startInput.value = endValue;
    }
  };

  syncDateConstraints();

  startInput.addEventListener('change', () => {
    enforceRangeOrder(startInput);
    syncDateConstraints();
  });

  endInput.addEventListener('change', () => {
    enforceRangeOrder(endInput);
    syncDateConstraints();
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      applyParticleSpeed(2.5);
      moveParticlesToCenter();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      statusEl.textContent = 'Please provide a Nightscout URL with token.';
      return;
    }
    statusEl.textContent = 'Collecting… this can take a moment.';
    try {
      const body = { url, start: startInput.value, end: endInput.value };
      const response = await fetch('/collect/v1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        let message = 'Request failed.';
        try {
          const error = await response.json();
          message = error && error.error ? error.error : message;
        } catch {}
        statusEl.textContent = message;
        return;
      }
      const yaml = await response.text();
      downloadYaml(yaml);
      statusEl.textContent = 'Download started.';
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'Unexpected error.';
    }
  });
});
