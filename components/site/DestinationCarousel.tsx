"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCoverflow, Mousewheel, Navigation, Parallax } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";

import type { Destination } from "@/lib/content";
import { formatElevation } from "@/components/site/labels";

/**
 * Coverflow of places, used as the controller for the homepage's live map:
 * each slide you land on, the map flies to.
 *
 * The 3D tilt isn't decoration: slides rake back like ridgelines receding into
 * haze, which is how Baguio reads from a viewpoint. Slides carry only a name
 * and a measured height, so the receding ones never show clipped paragraphs.
 */
export function DestinationCarousel({
  destinations,
  onActiveChange,
}: {
  destinations: Destination[];
  onActiveChange?: (destination: Destination) => void;
}) {
  return (
    <div className="baguio-swiper relative">
      <Swiper
        modules={[A11y, EffectCoverflow, Navigation, Mousewheel, Parallax]}
        effect="coverflow"
        grabCursor
        centeredSlides
        parallax
        loop
        autoHeight
        mousewheel={{ forceToAxis: true }}
        navigation
        // realIndexChange, not slideChange: with `loop`, Swiper fires slideChange
        // at init and on every resize, which would steer the map on its own.
        // realIndexChange fires only when the visitor lands on a different place.
        onRealIndexChange={(swiper) => onActiveChange?.(destinations[swiper.realIndex])}
        slidesPerView={1.3}
        spaceBetween={16}
        coverflowEffect={{ rotate: 0, stretch: 0, depth: 130, modifier: 1, slideShadows: false }}
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 2.4, spaceBetween: 24 },
        }}
        a11y={{ prevSlideMessage: "Previous destination", nextSlideMessage: "Next destination" }}
      >
        {destinations.map((d) => (
          <SwiperSlide key={d.slug}>
            <article className="weave-edge h-full border-y border-r border-border bg-card px-5 py-5">
              <h4 className="font-display text-xl leading-tight" data-swiper-parallax="-40">
                <Link href={`/destinations/${d.slug}`} className="hover:text-primary">
                  {d.name}
                </Link>
              </h4>
              {d.elevationM != null ? (
                <p className="readout mt-2 text-muted-foreground" data-swiper-parallax="-20">
                  {formatElevation(d.elevationM)}
                </p>
              ) : null}
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
