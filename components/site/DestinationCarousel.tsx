"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Keyboard, Mousewheel, Navigation, Parallax } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";

import type { Destination } from "@/lib/content";
import { formatCoord, formatElevation } from "@/components/site/labels";

/**
 * Coverflow carousel for the featured destinations.
 *
 * The 3D tilt is not decoration here: the slides rake back like ridgelines
 * receding into haze, which is how Baguio actually reads from a viewpoint.
 * Depth is the subject, so depth is the transition.
 */
export function DestinationCarousel({ destinations }: { destinations: Destination[] }) {
  return (
    <div className="baguio-swiper relative">
      <Swiper
        modules={[EffectCoverflow, Navigation, Keyboard, Mousewheel, Parallax]}
        effect="coverflow"
        grabCursor
        centeredSlides
        parallax
        loop
        keyboard={{ enabled: true }}
        mousewheel={{ forceToAxis: true }}
        navigation
        slidesPerView={1.08}
        spaceBetween={20}
        coverflowEffect={{
          rotate: 0,
          stretch: 0,
          // Keep depth modest: at modifier 1.6/depth 240 the neighbouring
          // slides translate far enough inward to overlap the active card and
          // the text collides. Recession should suggest distance, not stack.
          depth: 130,
          modifier: 1,
          slideShadows: false,
        }}
        breakpoints={{
          640: { slidesPerView: 1.5, spaceBetween: 28 },
          1024: { slidesPerView: 2.1, spaceBetween: 36 },
        }}
        a11y={{
          prevSlideMessage: "Previous destination",
          nextSlideMessage: "Next destination",
        }}
      >
        {destinations.map((d) => (
          <SwiperSlide key={d.slug}>
            <article className="weave-edge group h-full border-y border-r border-border bg-card py-7 pl-6 pr-6">
              <h3 className="font-display text-2xl leading-tight" data-swiper-parallax="-60">
                <Link href={`/destinations/${d.slug}`} className="hover:text-primary">
                  {d.name}
                </Link>
              </h3>

              <dl className="mt-4 flex gap-6" data-swiper-parallax="-40">
                {d.elevationM != null ? (
                  <div>
                    <dt className="text-[0.6875rem] text-muted-foreground">Elevation</dt>
                    <dd className="readout">{formatElevation(d.elevationM)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[0.6875rem] text-muted-foreground">Position</dt>
                  <dd className="readout">{formatCoord(d.lng, d.lat)}</dd>
                </div>
              </dl>

              <p
                className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground"
                data-swiper-parallax="-20"
              >
                {d.description}
              </p>

              <Link
                href={`/map?dest=${d.slug}`}
                className="mt-5 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                View on map
              </Link>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
