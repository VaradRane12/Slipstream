// A row of clickable driver "chips". Used by the Positions and Lap Times tabs.
// It doesn't keep any state itself: the parent passes in what's selected
// and a function to call when a chip is clicked ("lifting state up").
export default function DriverPicker({ drivers, selected, onToggle, lineStyles }) {
  return (
    <div className="driver-picker">
      {drivers.map((driver) => {
        const isSelected = selected.includes(driver.driver_number)
        const style = lineStyles[driver.driver_number]
        return (
          <button
            key={driver.driver_number}
            className={`chip ${isSelected ? 'chip--selected' : ''}`}
            style={{ '--chip-color': style.color }}
            onClick={() => onToggle(driver.driver_number)}
            aria-pressed={isSelected}
            title={driver.full_name}
          >
            <span className={`chip__swatch ${style.dashed ? 'chip__swatch--dashed' : ''}`} />
            {driver.name_acronym}
          </button>
        )
      })}
    </div>
  )
}
