(() => {
  const hosts = [...document.querySelectorAll('[data-liquid-gradient-host]')];
  if (!hosts.length) return;

  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = {
    color1: '#FFFFFF', color2: '#1E10C5', color3: '#9089E2', color4: '#FCFCFE',
    color5: '#F9F9FD', color6: '#B2B8E7', color7: '#0E2DCB', color8: '#0017E9',
    color9: '#4743EF', color10: '#7D7BF4', color11: '#0B06FC', color12: '#C5C1EA',
    color13: '#1403DE', color14: '#B6BAF6', color15: '#C1BEEB', color16: '#290ECB',
    color17: '#3F4CC0'
  };

  const states = {
    svg1: {
      transform: 'translate(287.5 280) rotate(-29.0546) scale(689.807 1000)',
      stops: [[0,'color1'],[0.188423,'color2'],[0.260417,'color3'],[0.328792,'color4'],[0.328892,'color5'],[0.328992,'color1'],[0.442708,'color6'],[0.537556,'color7'],[0.631738,'color1'],[0.725645,'color8'],[0.817779,'color9'],[0.84375,'color10'],[0.90569,'color1'],[1,'color11']]
    },
    svg2: {
      transform: 'translate(126.5 418.5) rotate(-64.756) scale(533.444 773.324)',
      stops: [[0,'color1'],[0.104167,'color12'],[0.182292,'color13'],[0.28125,'color1'],[0.328792,'color4'],[0.328892,'color5'],[0.453125,'color6'],[0.515625,'color7'],[0.631738,'color1'],[0.692708,'color8'],[0.75,'color14'],[0.817708,'color9'],[0.869792,'color10'],[1,'color1']]
    },
    svg3: {
      transform: 'translate(264.5 339.5) rotate(-42.3022) scale(946.451 1372.05)',
      stops: [[0,'color1'],[0.188423,'color2'],[0.307292,'color1'],[0.328792,'color4'],[0.328892,'color5'],[0.442708,'color15'],[0.537556,'color16'],[0.631738,'color1'],[0.725645,'color17'],[0.817779,'color9'],[0.84375,'color10'],[0.90569,'color1'],[1,'color11']]
    },
    svg4: {
      transform: 'translate(860.5 420) rotate(-153.984) scale(957.528 1388.11)',
      stops: [[0.109375,'color11'],[0.171875,'color2'],[0.260417,'color13'],[0.328792,'color4'],[0.328892,'color5'],[0.328992,'color1'],[0.442708,'color6'],[0.515625,'color7'],[0.631738,'color1'],[0.692708,'color8'],[0.817708,'color9'],[0.869792,'color10'],[1,'color11']]
    }
  };

  const order = ['svg1','svg2','svg3','svg4','svg3','svg2','svg1'];
  const transforms = order.map((key) => states[key].transform).join(';');
  let uid = 0;
  const allAnimations = [];
  const allSvgs = [];

  const svgEl = (name) => document.createElementNS(NS, name);

  function buildGradientSvg() {
    const svg = svgEl('svg');
    svg.setAttribute('viewBox', '0 0 1030 280');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('github-liquid-gradient-svg');

    const defs = svgEl('defs');
    const gradient = svgEl('radialGradient');
    const gradientId = `github-liquid-gradient-${++uid}`;
    gradient.id = gradientId;
    gradient.setAttribute('cx', '0');
    gradient.setAttribute('cy', '0');
    gradient.setAttribute('r', '1');
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradient.setAttribute('gradientTransform', states.svg1.transform);

    const transformAnimation = svgEl('animate');
    transformAnimation.setAttribute('attributeName', 'gradientTransform');
    transformAnimation.setAttribute('values', transforms);
    transformAnimation.setAttribute('dur', '10s');
    transformAnimation.setAttribute('repeatCount', 'indefinite');
    transformAnimation.setAttribute('calcMode', 'linear');
    gradient.append(transformAnimation);
    allAnimations.push(transformAnimation);

    const maxStops = Math.max(...Object.values(states).map((state) => state.stops.length));
    for (let index = 0; index < maxStops; index += 1) {
      const configs = order.map((key) => {
        const list = states[key].stops;
        return list[index] || list[list.length - 1];
      });
      const stop = svgEl('stop');
      stop.setAttribute('offset', String(configs[0][0]));
      stop.setAttribute('stop-color', COLORS[configs[0][1]]);

      const offsetAnimation = svgEl('animate');
      offsetAnimation.setAttribute('attributeName', 'offset');
      offsetAnimation.setAttribute('values', configs.map((config) => config[0]).join(';'));
      offsetAnimation.setAttribute('dur', '10s');
      offsetAnimation.setAttribute('repeatCount', 'indefinite');
      offsetAnimation.setAttribute('calcMode', 'linear');

      const colorAnimation = svgEl('animate');
      colorAnimation.setAttribute('attributeName', 'stop-color');
      colorAnimation.setAttribute('values', configs.map((config) => COLORS[config[1]]).join(';'));
      colorAnimation.setAttribute('dur', '10s');
      colorAnimation.setAttribute('repeatCount', 'indefinite');
      colorAnimation.setAttribute('calcMode', 'linear');

      stop.append(offsetAnimation, colorAnimation);
      gradient.append(stop);
      allAnimations.push(offsetAnimation, colorAnimation);
    }

    defs.append(gradient);
    const rect = svgEl('rect');
    rect.setAttribute('width', '1030');
    rect.setAttribute('height', '280');
    rect.setAttribute('rx', '140');
    rect.setAttribute('fill', `url(#${gradientId})`);
    svg.append(rect, defs);
    allSvgs.push(svg);
    return svg;
  }

  function mountLiquid(host) {
    for (let index = 0; index < 7; index += 1) {
      const layer = document.createElement('span');
      layer.className = `github-liquid-layer github-liquid-layer-${index}`;
      layer.append(buildGradientSvg());
      host.append(layer);
    }
  }

  hosts.forEach(mountLiquid);

  const button = document.querySelector('.github-liquid-button');
  const setDuration = (seconds) => {
    allAnimations.forEach((animation) => {
      animation.setAttribute('dur', `${seconds}s`);
      if (typeof animation.beginElement === 'function') animation.beginElement();
    });
  };

  button?.addEventListener('mouseenter', () => setDuration(50));
  button?.addEventListener('mouseleave', () => setDuration(10));
  button?.addEventListener('focus', () => setDuration(50));
  button?.addEventListener('blur', () => setDuration(10));

  document.addEventListener('visibilitychange', () => {
    allSvgs.forEach((svg) => {
      if (document.hidden && typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
      if (!document.hidden && typeof svg.unpauseAnimations === 'function') svg.unpauseAnimations();
    });
  });
})();
