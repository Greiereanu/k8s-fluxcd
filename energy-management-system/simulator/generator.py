import random
from dataclasses import dataclass, field


@dataclass
class DeviceLoadProfile:
    base_load: float = 0.06
    volatility: float = 0.01
    current_load: float = field(init=False)
    counter: int = 0

    def __post_init__(self):
        self.current_load = self.base_load

    def next_value(self, enable_spikes: bool = False, spike_every: int = 30) -> float:
        self.counter += 1

        # Smooth continuous random walk with mean reversion around a small value
        drift = 0.1 * (self.base_load - self.current_load)
        noise = random.gauss(0, self.volatility)
        self.current_load = max(0.02, min(0.15, self.current_load + drift + noise))

        # Optional subtle load increment rather than an instant spike
        if enable_spikes and (self.counter % spike_every == 0):
            subtle_bump = random.uniform(0.04, 0.08)
            return round(self.current_load + subtle_bump, 3)

        return round(self.current_load, 3)


class SensorLoadSimulator:
    def __init__(self, enable_spikes: bool = False, spike_every: int = 30):
        self.enable_spikes = enable_spikes
        self.spike_every = spike_every
        self.profiles: dict[str, DeviceLoadProfile] = {}

    def get_reading(self, device_id: str) -> float:
        if device_id not in self.profiles:
            base = random.uniform(0.04, 0.08)
            self.profiles[device_id] = DeviceLoadProfile(base_load=base)

        return self.profiles[device_id].next_value(
            enable_spikes=self.enable_spikes,
            spike_every=self.spike_every,
        )
