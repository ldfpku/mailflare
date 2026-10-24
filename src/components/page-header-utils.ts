// A page's primary "New ..." button floats at the bottom of the screen on phones, within thumb reach.
export const mobilePrimaryActionClass =
	"max-md:fixed max-md:inset-x-4 max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:z-40 max-md:h-12 max-md:rounded-full max-md:shadow-lg";

// Same, lifted above the settings section pill.
export const mobilePrimaryActionAboveNavClass =
	"max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(4rem+max(1rem,env(safe-area-inset-bottom)))] max-md:z-40 max-md:h-12 max-md:rounded-full max-md:shadow-lg";
